-- Allow players to update preferred zones after onboarding.

create or replace function public.set_player_preferred_zones(p_zone_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_zone_count integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
      and p.onboarding_completed_at is not null
      and p.account_status = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Onboarding must be complete';
  end if;

  if p_zone_ids is null
     or cardinality(p_zone_ids) = 0
     or cardinality(p_zone_ids) > 10
     or exists (
       select 1
       from unnest(p_zone_ids) as supplied(zone_id)
       where supplied.zone_id is null
     )
     or cardinality(p_zone_ids) <> (
       select count(distinct supplied.zone_id)
       from unnest(p_zone_ids) as supplied(zone_id)
     ) then
    raise exception using
      errcode = '22023',
      message = 'One to ten unique zones are required';
  end if;

  select count(*)
  into v_zone_count
  from public.zones as z
  where z.id = any(p_zone_ids)
    and z.is_active = true;

  if v_zone_count <> cardinality(p_zone_ids) then
    raise exception using
      errcode = '22023',
      message = 'Every selected zone must exist and be active';
  end if;

  delete from public.player_zones
  where user_id = v_user_id;

  insert into public.player_zones (user_id, zone_id, priority)
  select v_user_id, supplied.zone_id, supplied.position::smallint
  from unnest(p_zone_ids) with ordinality as supplied(zone_id, position);
end;
$$;

revoke all on function public.set_player_preferred_zones(uuid[]) from public;
grant execute on function public.set_player_preferred_zones(uuid[]) to authenticated;
