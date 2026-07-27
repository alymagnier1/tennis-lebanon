-- Milestone 8.1: user report submission and platform operator moderation queue.

create type public.user_report_queue_row as (
  report_id uuid,
  status public.report_status,
  category text,
  note text,
  reporter_id uuid,
  reporter_name text,
  reported_user_id uuid,
  reported_user_name text,
  match_id uuid,
  created_at timestamptz
);

create or replace function public.submit_user_report(
  p_category text,
  p_note text default null,
  p_reported_user_id uuid default null,
  p_match_id uuid default null,
  p_message_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_category text;
  v_note text;
  v_report_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();
  v_category := lower(trim(coalesce(p_category, '')));
  v_note := nullif(trim(coalesce(p_note, '')), '');

  if v_category not in (
    'harassment',
    'unsafe_conduct',
    'spam',
    'fraud',
    'privacy',
    'other'
  ) then
    raise exception using errcode = 'P0001', message = 'Invalid report category';
  end if;

  if p_reported_user_id is null
    and p_match_id is null
    and p_message_id is null then
    raise exception using errcode = 'P0001', message = 'Report target is required';
  end if;

  if p_reported_user_id = v_user_id then
    raise exception using errcode = 'P0001', message = 'You cannot report yourself';
  end if;

  if p_reported_user_id is not null
    and exists (
      select 1
      from public.user_reports as ur
      where ur.reporter_id = v_user_id
        and ur.reported_user_id = p_reported_user_id
        and ur.created_at > now() - interval '1 day'
    ) then
    raise exception using errcode = 'P0001', message = 'report_rate_limited';
  end if;

  if p_match_id is not null then
    perform public.assert_accepted_match_participant(p_match_id, v_user_id);
  end if;

  if p_message_id is not null then
    if not exists (
      select 1
      from public.match_messages as mm
      join public.match_participants as mp
        on mp.match_id = mm.match_id
       and mp.user_id = v_user_id
       and mp.status = 'accepted'
      where mm.id = p_message_id
    ) then
      raise exception using errcode = '42501', message = 'Only match participants can report messages';
    end if;
  end if;

  insert into public.user_reports (
    reporter_id,
    reported_user_id,
    match_id,
    message_id,
    category,
    note
  )
  values (
    v_user_id,
    p_reported_user_id,
    p_match_id,
    p_message_id,
    v_category,
    v_note
  )
  returning id into v_report_id;

  return v_report_id;
end;
$$;

create or replace function public.list_open_user_reports(p_limit integer default 50)
returns setof public.user_report_queue_row
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
    ur.id,
    ur.status,
    ur.category,
    ur.note,
    ur.reporter_id,
    reporter_profile.display_name,
    ur.reported_user_id,
    reported_profile.display_name,
    ur.match_id,
    ur.created_at
  from public.user_reports as ur
  join public.profiles as reporter_profile
    on reporter_profile.id = ur.reporter_id
  left join public.profiles as reported_profile
    on reported_profile.id = ur.reported_user_id
  where ur.status in ('open', 'investigating')
  order by ur.created_at asc
  limit v_limit;
end;
$$;

create or replace function public.resolve_user_report(
  p_report_id uuid,
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
  v_report public.user_reports%rowtype;
  v_resolution text;
  v_reason text;
  v_status public.report_status;
begin
  v_admin_id := public.assert_platform_operator();
  v_resolution := lower(trim(coalesce(p_resolution, '')));
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'Resolution reason is required';
  end if;

  if v_resolution = 'dismiss' then
    v_status := 'dismissed';
  elsif v_resolution = 'resolve' then
    v_status := 'resolved';
  else
    raise exception using errcode = 'P0001', message = 'Resolution must be dismiss or resolve';
  end if;

  select *
  into v_report
  from public.user_reports as ur
  where ur.id = p_report_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Report not found';
  end if;

  if v_report.status not in ('open', 'investigating') then
    raise exception using errcode = 'P0001', message = 'Report is not open';
  end if;

  update public.user_reports as ur
  set
    status = v_status,
    assigned_to = v_admin_id,
    resolved_at = now()
  where ur.id = p_report_id;

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
    'user_report_resolved',
    'user_report',
    p_report_id,
    v_reason,
    jsonb_build_object(
      'resolution', v_resolution,
      'reported_user_id', v_report.reported_user_id,
      'match_id', v_report.match_id
    )
  );
end;
$$;

revoke all on function public.submit_user_report(text, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.submit_user_report(text, text, uuid, uuid, uuid) to authenticated;

revoke all on function public.list_open_user_reports(integer) from public, anon;
grant execute on function public.list_open_user_reports(integer) to authenticated;

revoke all on function public.resolve_user_report(uuid, text, text) from public, anon;
grant execute on function public.resolve_user_report(uuid, text, text) to authenticated;
