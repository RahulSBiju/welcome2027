-- =====================================================================
-- Year End Vacation Planner: database schema
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Run it once only, on an empty project.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- One row per person who signs up (created automatically on sign-up).
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- A trip that friends plan together. Friends join with the invite code.
create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- Who is in which trip, and how many leave days each person has.
create table public.trip_members (
  trip_id    uuid not null references public.trips on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  leave_days int  check (leave_days between 0 and 365),
  joined_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- Suggested destinations.
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  description text,
  link_url    text,
  added_by    uuid not null default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- One upvote per person per location.
create table public.location_votes (
  location_id uuid not null references public.locations on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (location_id, user_id)
);

-- Photos attached to a location (the file itself lives in Storage).
create table public.location_images (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations on delete cascade,
  storage_path text not null,
  uploaded_by  uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- Date ranges when a person is free to travel.
create table public.availability (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  start_date date not null,
  end_date   date not null,
  note       text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- Proposed trip dates anyone can suggest.
create table public.date_suggestions (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips on delete cascade,
  start_date   date not null,
  end_date     date not null,
  note         text,
  suggested_by uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);

-- Comments on a location, a date suggestion, or the trip in general.
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips on delete cascade,
  target_type text not null check (target_type in ('trip', 'location', 'date_suggestion')),
  target_id   uuid,
  user_id     uuid not null default auth.uid() references public.profiles (id),
  body        text not null check (char_length(body) between 1 and 2000),
  link_url    text,
  created_at  timestamptz not null default now()
);

create index on public.trip_members (user_id);
create index on public.locations (trip_id);
create index on public.availability (trip_id);
create index on public.date_suggestions (trip_id);
create index on public.comments (trip_id, target_type, target_id);
create index on public.location_images (location_id);


-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- True if the signed-in user belongs to the given trip.
create function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

-- Create a profile automatically whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create a trip and make the creator its owner. Called from the app.
create function public.create_trip(p_name text)
returns public.trips
language plpgsql security definer set search_path = ''
as $$
declare
  new_trip public.trips;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.trips (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into new_trip;

  insert into public.trip_members (trip_id, user_id, role)
  values (new_trip.id, auth.uid(), 'owner');

  return new_trip;
end;
$$;

-- Join a trip using its 6-character invite code. Called from the app.
create function public.join_trip(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  found_trip_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into found_trip_id
  from public.trips
  where invite_code = upper(trim(p_code));

  if found_trip_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.trip_members (trip_id, user_id)
  values (found_trip_id, auth.uid())
  on conflict do nothing;

  return found_trip_id;
end;
$$;

revoke execute on function public.create_trip(text) from public, anon;
revoke execute on function public.join_trip(text) from public, anon;
grant execute on function public.create_trip(text) to authenticated;
grant execute on function public.join_trip(text) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 3. SECURITY RULES (Row Level Security)
--    Nobody can see or change anything unless a policy below allows it.
-- ---------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.trips            enable row level security;
alter table public.trip_members     enable row level security;
alter table public.locations        enable row level security;
alter table public.location_votes   enable row level security;
alter table public.location_images  enable row level security;
alter table public.availability     enable row level security;
alter table public.date_suggestions enable row level security;
alter table public.comments         enable row level security;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Members may only change their own leave_days, never their role.
revoke update on public.trip_members from authenticated;
grant update (leave_days) on public.trip_members to authenticated;

-- profiles: see yourself and people who share a trip with you
create policy "profiles: read self and trip-mates" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.trip_members mine
      join public.trip_members theirs on theirs.trip_id = mine.trip_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- trips: members can read; owner can rename or delete
-- (new trips are created through create_trip())
create policy "trips: members read" on public.trips
  for select to authenticated using (public.is_trip_member(id));
create policy "trips: owner updates" on public.trips
  for update to authenticated using (created_by = auth.uid());
create policy "trips: owner deletes" on public.trips
  for delete to authenticated using (created_by = auth.uid());

-- trip_members: members see each other; you can update or leave yourself
-- (joining happens through join_trip())
create policy "members: members read" on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "members: update self" on public.trip_members
  for update to authenticated using (user_id = auth.uid());
create policy "members: leave" on public.trip_members
  for delete to authenticated using (user_id = auth.uid());

-- locations
create policy "locations: members read" on public.locations
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "locations: members add" on public.locations
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and added_by = auth.uid());
create policy "locations: author updates" on public.locations
  for update to authenticated using (added_by = auth.uid());
create policy "locations: author deletes" on public.locations
  for delete to authenticated using (added_by = auth.uid());

-- location_votes
create policy "votes: members read" on public.location_votes
  for select to authenticated
  using (public.is_trip_member((select trip_id from public.locations l where l.id = location_id)));
create policy "votes: members vote" on public.location_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_trip_member((select trip_id from public.locations l where l.id = location_id))
  );
create policy "votes: remove own" on public.location_votes
  for delete to authenticated using (user_id = auth.uid());

-- location_images
create policy "images: members read" on public.location_images
  for select to authenticated
  using (public.is_trip_member((select trip_id from public.locations l where l.id = location_id)));
create policy "images: members add" on public.location_images
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.is_trip_member((select trip_id from public.locations l where l.id = location_id))
  );
create policy "images: uploader deletes" on public.location_images
  for delete to authenticated using (uploaded_by = auth.uid());

-- availability
create policy "availability: members read" on public.availability
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "availability: add own" on public.availability
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and user_id = auth.uid());
create policy "availability: update own" on public.availability
  for update to authenticated using (user_id = auth.uid());
create policy "availability: delete own" on public.availability
  for delete to authenticated using (user_id = auth.uid());

-- date_suggestions
create policy "dates: members read" on public.date_suggestions
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "dates: members add" on public.date_suggestions
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and suggested_by = auth.uid());
create policy "dates: author updates" on public.date_suggestions
  for update to authenticated using (suggested_by = auth.uid());
create policy "dates: author deletes" on public.date_suggestions
  for delete to authenticated using (suggested_by = auth.uid());

-- comments
create policy "comments: members read" on public.comments
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "comments: members add" on public.comments
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and user_id = auth.uid());
create policy "comments: author updates" on public.comments
  for update to authenticated using (user_id = auth.uid());
create policy "comments: author deletes" on public.comments
  for delete to authenticated using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 4. PHOTO STORAGE
--    Files are stored as  trip-images/<trip_id>/<file name>
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-images', 'trip-images', false, 5242880,  -- 5 MB per photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

create policy "trip images: members read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-images'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );
create policy "trip images: members upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-images'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );
create policy "trip images: uploader deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-images' and owner_id = auth.uid()::text);
