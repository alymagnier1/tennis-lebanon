-- Public profile availability: per-weekday day-part breakdown for profile UI.

create or replace function public.get_public_player_availability_summary(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
begin
  v_viewer_id := public.assert_discovery_caller_eligible();

  if p_user_id = v_viewer_id then
    raise exception using
      errcode = '42501',
      message = 'Cannot load own public availability via this RPC';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = p_user_id
      and p.account_status = 'active'
      and p.onboarding_completed_at is not null
      and p.is_adult_confirmed = true
      and not public.is_blocked(v_viewer_id, p.id)
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Player not found';
  end if;

  return jsonb_build_object(
    'weekdays',
    coalesce(
      (
        select jsonb_agg(distinct aw.weekday order by aw.weekday)
        from public.availability_windows as aw
        where aw.user_id = p_user_id
          and aw.is_recurring = true
      ),
      '[]'::jsonb
    ),
    'day_parts',
    coalesce(
      (
        select jsonb_agg(distinct part order by part)
        from (
          select public.availability_day_part_from_local(aw.local_start) as part
          from public.availability_windows as aw
          where aw.user_id = p_user_id
            and aw.is_recurring = true
        ) as parts
      ),
      '[]'::jsonb
    ),
    'by_weekday',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'weekday', grouped.weekday,
            'day_parts', grouped.day_parts
          )
          order by grouped.weekday
        )
        from (
          select
            aw.weekday,
            jsonb_agg(
              distinct public.availability_day_part_from_local(aw.local_start)
              order by public.availability_day_part_from_local(aw.local_start)
            ) as day_parts
          from public.availability_windows as aw
          where aw.user_id = p_user_id
            and aw.is_recurring = true
          group by aw.weekday
        ) as grouped
      ),
      '[]'::jsonb
    )
  );
end;
$$;
