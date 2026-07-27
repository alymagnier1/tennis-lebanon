-- Milestone 7.5: platform operator dispute queue and resolution RPCs.

create or replace function public.is_platform_operator(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_roles as pr
    where pr.user_id = p_user_id
      and pr.role in ('support', 'admin')
  );
$$;

create or replace function public.assert_platform_operator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not public.is_platform_operator(v_user_id) then
    raise exception using errcode = '42501', message = 'Platform operator role required';
  end if;

  return v_user_id;
end;
$$;

create type public.disputed_result_queue_row as (
  result_id uuid,
  match_id uuid,
  status public.result_status,
  score jsonb,
  winner_user_id uuid,
  winner_name text,
  submitted_by uuid,
  submitted_by_name text,
  dispute_note text,
  disputed_at timestamptz,
  match_format public.match_format
);

create or replace function public.list_disputed_results(p_limit integer default 50)
returns setof public.disputed_result_queue_row
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  perform public.assert_platform_operator();
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  return query
  select
    mr.id,
    mr.match_id,
    mr.status,
    mr.score,
    mr.winner_user_id,
    winner_profile.display_name,
    mr.submitted_by,
    submitter_profile.display_name,
    mr.dispute_note,
    mr.updated_at,
    m.format
  from public.match_results as mr
  join public.matches as m on m.id = mr.match_id
  join public.profiles as winner_profile on winner_profile.id = mr.winner_user_id
  join public.profiles as submitter_profile on submitter_profile.id = mr.submitted_by
  where mr.status = 'disputed'
  order by mr.updated_at asc
  limit v_limit;
end;
$$;

create or replace function public.resolve_match_result_dispute(
  p_result_id uuid,
  p_resolution text,
  p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_result public.match_results%rowtype;
  v_resolution text;
  v_reason text;
begin
  v_admin_id := public.assert_platform_operator();
  v_resolution := lower(trim(coalesce(p_resolution, '')));
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'Resolution reason is required';
  end if;

  if v_resolution not in ('confirm', 'void') then
    raise exception using errcode = 'P0001', message = 'Resolution must be confirm or void';
  end if;

  select *
  into v_result
  from public.match_results as mr
  where mr.id = p_result_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Result not found';
  end if;

  if v_result.status <> 'disputed' then
    raise exception using errcode = 'P0001', message = 'Result is not disputed';
  end if;

  if v_resolution = 'confirm' then
    update public.match_results as mr
    set
      status = 'confirmed',
      confirmed_at = now(),
      resolved_by = v_admin_id,
      resolved_at = now(),
      updated_at = now()
    where mr.id = p_result_id;

    perform public.apply_rating_for_result(p_result_id);
  else
    update public.match_results as mr
    set
      status = 'resolved',
      resolved_by = v_admin_id,
      resolved_at = now(),
      updated_at = now()
    where mr.id = p_result_id;
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_admin_id,
    'match_result_dispute_resolved',
    'match_result',
    p_result_id,
    v_reason,
    jsonb_build_object(
      'resolution', v_resolution,
      'match_id', v_result.match_id
    )
  );
end;
$$;

revoke all on function public.is_platform_operator(uuid) from public, anon;
revoke all on function public.assert_platform_operator() from public, anon;
revoke all on function public.list_disputed_results(integer) from public, anon;
revoke all on function public.resolve_match_result_dispute(uuid, text, text) from public, anon;

grant execute on function public.is_platform_operator(uuid) to authenticated;
grant execute on function public.list_disputed_results(integer) to authenticated;
grant execute on function public.resolve_match_result_dispute(uuid, text, text) to authenticated;
