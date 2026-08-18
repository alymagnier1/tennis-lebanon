-- Optional private note when a player marks no-show attendance.
-- Stored only on audit_events for ops — never shown to other participants.

drop function if exists public.record_match_attendance(uuid, public.attendance_status);

create or replace function public.record_match_attendance(
  p_match_id uuid,
  p_attendance public.attendance_status,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_status public.match_status;
  v_note text;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select m.status
  into v_status
  from public.matches as m
  where m.id = p_match_id;

  if v_status not in ('in_progress', 'completed') then
    raise exception using errcode = 'P0001', message = 'Attendance can only be recorded after the match starts';
  end if;

  if p_attendance not in ('attended', 'no_show', 'late_cancel', 'cancelled_in_time') then
    raise exception using errcode = 'P0001', message = 'Invalid attendance status';
  end if;

  update public.match_participants as mp
  set attendance = p_attendance
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id;

  if p_attendance = 'no_show' then
    v_note := left(nullif(trim(coalesce(p_note, '')), ''), 200);
    insert into public.audit_events (
      actor_id, action, entity_type, entity_id, metadata
    )
    values (
      v_user_id,
      'match_attendance_no_show',
      'match',
      p_match_id,
      case
        when v_note is null then '{}'::jsonb
        else jsonb_build_object('note', v_note)
      end
    );
  end if;

  -- The last answer completes the match there and then, rather than leaving it
  -- to the hourly sweep: the player who just tapped should see it land.
  perform public.apply_attendance_completion(p_match_id);
end;
$$;

revoke all on function public.record_match_attendance(uuid, public.attendance_status, text) from public, anon;
grant execute on function public.record_match_attendance(uuid, public.attendance_status, text) to authenticated;
