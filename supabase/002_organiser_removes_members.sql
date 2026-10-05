-- =====================================================================
-- Update 002: trip organisers can remove other members
-- Paste into Supabase > SQL Editor > New query > Run. Run it once only.
-- =====================================================================

-- The trip's creator (organiser) may remove anyone except themselves.
create policy "members: organiser removes others" on public.trip_members
  for delete to authenticated
  using (
    user_id <> auth.uid()
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.created_by = auth.uid()
    )
  );

-- When someone leaves or is removed, delete their dates and votes for that trip,
-- so they no longer count towards "Best dates" or place rankings.
-- (Their places and comments stay, so the discussion still makes sense.)
create function public.cleanup_removed_member()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.availability
  where trip_id = old.trip_id and user_id = old.user_id;

  delete from public.location_votes v
  using public.locations l
  where v.location_id = l.id
    and l.trip_id = old.trip_id
    and v.user_id = old.user_id;

  return old;
end;
$$;

create trigger on_trip_member_removed
  after delete on public.trip_members
  for each row execute function public.cleanup_removed_member();
