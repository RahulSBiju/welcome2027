-- Read-only check that update 002 was applied. Safe to run any time; it changes nothing.
-- Paste into Supabase > SQL Editor > New query > Run.
-- Expected result: both rows say "✅ installed".

select 'Policy: organiser removes others' as item,
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'trip_members'
           and policyname = 'members: organiser removes others'
       ) then '✅ installed' else '❌ missing' end as status
union all
select 'Trigger: cleanup when a member is removed',
       case when exists (
         select 1 from pg_trigger
         where tgname = 'on_trip_member_removed' and not tgisinternal
       ) then '✅ installed' else '❌ missing' end;
