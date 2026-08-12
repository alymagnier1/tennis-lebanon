\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(13);

-- Structure.
select has_table(
  'public',
  'match_activity',
  'match_activity table exists'
);

select has_function(
  'public',
  'is_match_activity_viewer',
  array['uuid', 'uuid'],
  'is_match_activity_viewer helper exists'
);

select policy_cmd_is(
  'public',
  'match_activity',
  'match_activity_select_viewer',
  'SELECT',
  'match_activity exposes a select-only policy'
);

-- Realtime only delivers rows a client could select, so the table has to be in
-- the publication AND carry the policy above. Missing either yields a channel
-- that subscribes cleanly and never fires.
select is(
  (
    select count(*)::integer
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_activity'
  ),
  1,
  'match_activity is published to supabase_realtime'
);

-- The doorbell is readable, never writable: triggers do the writing from inside
-- security definer RPCs. A client that could write it could fake activity.
select ok(
  not has_table_privilege('authenticated', 'public.match_activity', 'INSERT'),
  'authenticated cannot insert match_activity'
);

select ok(
  not has_table_privilege('authenticated', 'public.match_activity', 'UPDATE'),
  'authenticated cannot update match_activity'
);

select ok(
  has_table_privilege('authenticated', 'public.match_activity', 'SELECT'),
  'authenticated can select match_activity'
);

-- Every existing match got a row, so a first subscribe has something to watch.
select is_empty(
  $$
    select m.id
    from public.matches as m
    where not exists (
      select 1 from public.match_activity as ma where ma.match_id = m.id
    )
  $$,
  'every match has an activity row'
);

-- Trigger behaviour. This is the whole point: a write by one participant has to
-- move the timestamp the other participant is subscribed to.
-- Resolved from the seed rather than hard-coded: match_participants.user_id
-- references player_profiles, so the fixture needs a profiled player who is not
-- already in this match.
create temporary table t_fixture on commit drop as
with target as (
  select m.id from public.matches as m order by m.id limit 1
)
select
  target.id as match_id,
  (
    select pp.user_id
    from public.player_profiles as pp
    where not exists (
      select 1
      from public.match_participants as mp
      where mp.match_id = target.id
        and mp.user_id = pp.user_id
    )
    order by pp.user_id
    limit 1
  ) as stranger_id
from target;

update public.match_activity
set updated_at = now() - interval '1 hour'
where match_id = (select match_id from t_fixture);

insert into public.match_participants (match_id, user_id, status, is_creator)
values (
  (select match_id from t_fixture),
  (select stranger_id from t_fixture),
  'requested',
  false
);

select ok(
  (
    select ma.updated_at > now() - interval '1 minute'
    from public.match_activity as ma
    where ma.match_id = (select match_id from t_fixture)
  ),
  'a join bumps the match activity timestamp'
);

-- A status change on the match row itself has to ping too, so the joiner sees
-- the host publish, book, or cancel.
update public.match_activity
set updated_at = now() - interval '1 hour'
where match_id = (select match_id from t_fixture);

update public.matches
set notes = coalesce(notes, '') || ' ping'
where id = (select match_id from t_fixture);

select ok(
  (
    select ma.updated_at > now() - interval '1 minute'
    from public.match_activity as ma
    where ma.match_id = (select match_id from t_fixture)
  ),
  'a match row change bumps the match activity timestamp'
);

-- Viewer predicate — the security boundary, so assert both directions.
select ok(
  public.is_match_activity_viewer(
    (select match_id from t_fixture),
    (select stranger_id from t_fixture)
  ),
  'a requested participant may watch activity'
);

update public.match_participants
set status = 'accepted'
where match_id = (select match_id from t_fixture)
  and user_id = (select stranger_id from t_fixture);

select ok(
  public.is_match_activity_viewer(
    (select match_id from t_fixture),
    (select stranger_id from t_fixture)
  ),
  'an accepted participant may watch activity'
);

delete from public.match_participants
where match_id = (select match_id from t_fixture)
  and user_id = (select stranger_id from t_fixture);

select ok(
  not public.is_match_activity_viewer(
    (select match_id from t_fixture),
    (select stranger_id from t_fixture)
  ),
  'a non-participant may not watch activity'
);

select * from finish();
rollback;
