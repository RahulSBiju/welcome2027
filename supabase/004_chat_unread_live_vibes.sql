-- =====================================================================
-- Update 004: unread group-chat badge, live chat, saved "Place vibes"
-- Paste into Supabase > SQL Editor > New query > Run. Run it once only.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. UNREAD BADGE: when did each person last open the trip's Group chat?
-- ---------------------------------------------------------------------
create table public.chat_reads (
  trip_id      uuid not null references public.trips on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.chat_reads enable row level security;
grant select on public.chat_reads to authenticated;

create policy "chat reads: read own" on public.chat_reads
  for select to authenticated using (user_id = auth.uid());

-- Marks the chat as read "now" (using the server's clock, so phone clocks can't confuse it).
create function public.mark_chat_read(p_trip_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_trip_member(p_trip_id) then
    raise exception 'Not a member of this trip';
  end if;
  insert into public.chat_reads (trip_id, user_id, last_read_at)
  values (p_trip_id, auth.uid(), now())
  on conflict (trip_id, user_id) do update set last_read_at = now();
end;
$$;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 2. LIVE CHAT: send new comments to open apps instantly (Supabase Realtime).
--    Realtime still respects the security rules: you only receive comments
--    from trips you're a member of.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.comments;


-- ---------------------------------------------------------------------
-- 3. PLACE VIBES: weather + Wikipedia/Wikivoyage info, saved once per place
--    so it isn't looked up again every time someone opens it.
-- ---------------------------------------------------------------------
alter table public.locations add column vibes jsonb;

-- Any trip member may save (or refresh) a place's vibes.
create function public.save_place_vibes(p_place_id uuid, p_vibes jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.locations
  set vibes = p_vibes
  where id = p_place_id and public.is_trip_member(trip_id);
end;
$$;
revoke execute on function public.save_place_vibes(uuid, jsonb) from public, anon;
grant execute on function public.save_place_vibes(uuid, jsonb) to authenticated;
