-- Milestone 7.6: completed match history for the Matches tab.

create or replace function public.list_my_completed_matches()
returns table (
  match_id uuid,
  format public.match_format,
  result_status public.result_status,
  score jsonb,
  winner_user_id uuid,
  viewer_won boolean,
  opponent_names text,
  played_at timestamptz,
  club_name text,
  completed_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  return query
  select
    m.id,
    m.format,
    mr.status,
    mr.score,
    mr.winner_user_id,
    mr.winner_user_id = v_user_id,
    (
      select string_agg(p.display_name, ', ' order by p.display_name)
      from public.match_participants as mp_other
      join public.profiles as p on p.id = mp_other.user_id
      where mp_other.match_id = m.id
        and mp_other.status = 'accepted'
        and mp_other.user_id <> v_user_id
    ),
    b.starts_at,
    c.name,
    coalesce(mr.confirmed_at, mr.resolved_at, m.updated_at)
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  join public.match_results as mr on mr.match_id = m.id
  left join lateral (
    select b_inner.starts_at, b_inner.court_id
    from public.bookings as b_inner
    where b_inner.match_id = m.id
      and b_inner.status = 'accepted'
    order by b_inner.created_at desc
    limit 1
  ) as b on true
  left join public.courts as ct on ct.id = b.court_id
  left join public.clubs as c on c.id = ct.club_id
  where mp.user_id = v_user_id
    and mp.status = 'accepted'
    and m.status = 'completed'
  order by coalesce(mr.confirmed_at, mr.resolved_at, m.updated_at) desc;
end;
$$;

revoke all on function public.list_my_completed_matches() from public, anon;
grant execute on function public.list_my_completed_matches() to authenticated;
