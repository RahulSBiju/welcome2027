-- =====================================================================
-- Update 003: pin final choice, packing list, push notifications
-- Paste into Supabase > SQL Editor > New query > Run. Run it once only.
-- (Push notifications also need the steps in docs/PUSH_SETUP.md.)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PIN: the organiser locks in the final destination and dates
--    (trips already has "trips: owner updates", so only the organiser can set these)
-- ---------------------------------------------------------------------
alter table public.trips
  add column pinned_location_id uuid references public.locations on delete set null,
  add column pinned_start date,
  add column pinned_end date,
  add constraint pinned_dates_valid check (
    (pinned_start is null and pinned_end is null)
    or (pinned_start is not null and pinned_end is not null and pinned_end >= pinned_start)
  );


-- ---------------------------------------------------------------------
-- 2. PACKING LIST
--    Shared items: the whole group sees them; anyone can say "I'll bring it".
--    Personal items: only the person who added them can see them.
-- ---------------------------------------------------------------------
create table public.packing_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  is_personal boolean not null default false,
  assigned_to uuid references public.profiles on delete set null,  -- who's bringing it (shared items)
  is_packed   boolean not null default false,
  created_by  uuid not null default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index on public.packing_items (trip_id);

alter table public.packing_items enable row level security;
grant select, insert, update, delete on public.packing_items to authenticated;

create policy "packing: read shared + own personal" on public.packing_items
  for select to authenticated
  using (public.is_trip_member(trip_id) and (not is_personal or created_by = auth.uid()));
create policy "packing: members add" on public.packing_items
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "packing: update shared or own" on public.packing_items
  for update to authenticated
  using (public.is_trip_member(trip_id) and (not is_personal or created_by = auth.uid()))
  with check (public.is_trip_member(trip_id) and (not is_personal or created_by = auth.uid()));
create policy "packing: creator or organiser deletes" on public.packing_items
  for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid())
  );

-- A removed member's personal items go with them; shared items they claimed become unclaimed.
create or replace function public.cleanup_removed_member()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.availability
  where trip_id = old.trip_id and user_id = old.user_id;

  delete from public.location_votes v
  using public.locations l
  where v.location_id = l.id and l.trip_id = old.trip_id and v.user_id = old.user_id;

  delete from public.packing_items
  where trip_id = old.trip_id and created_by = old.user_id and is_personal;

  update public.packing_items set assigned_to = null, is_packed = false
  where trip_id = old.trip_id and assigned_to = old.user_id;

  return old;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. PUSH NOTIFICATIONS
-- ---------------------------------------------------------------------

-- Each browser/phone that turned on notifications.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create policy "push: manage own" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- When something happens, call the "send-push" Edge Function, which notifies the other members.
-- The shared secret lives in Supabase Vault (see docs/PUSH_SETUP.md), not in this file.
create extension if not exists pg_net with schema extensions;

create function public.notify_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets where name = 'push_webhook_secret';
  if secret is null then
    return new;  -- push isn't set up yet: do nothing
  end if;

  perform net.http_post(
    url := 'https://dtlrimbzcswegrolptbe.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object(
      'table', tg_table_name,
      'type', tg_op,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    )
  );
  return new;
end;
$$;

create trigger push_on_new_place after insert on public.locations
  for each row execute function public.notify_push();
create trigger push_on_new_comment after insert on public.comments
  for each row execute function public.notify_push();
create trigger push_on_member_joined after insert on public.trip_members
  for each row execute function public.notify_push();
create trigger push_on_trip_pinned after update of pinned_location_id, pinned_start, pinned_end on public.trips
  for each row execute function public.notify_push();
