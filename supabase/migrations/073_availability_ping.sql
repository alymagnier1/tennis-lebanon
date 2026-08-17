-- The "I'm free" ping: one tap that says "I would play then", without creating a
-- match.
--
-- The smallest unit of intent the product accepted was a fully specified match --
-- format, level, zone, clubs, time. Someone with a free Thursday and mild
-- interest had nowhere to put it, so the evening was lost. This is the Starter
-- Step: a tap with no commitment.
--
-- Deliberately NOT a new table. `availability_windows` already models a one-off
-- slot (`is_recurring = false` with `starts_at`/`ends_at`), and discovery already
-- computes overlap against it (039/040/055). So a ping makes the player
-- discoverable to everyone whose availability overlaps, through machinery that
-- already exists, and they can see and remove it on the availability screen like
-- any other window. Before this, that shape had 36 recurring rows and zero
-- one-off ones -- the ping is its first real user.
--
-- An RPC rather than the direct insert `createAvailabilityWindow` uses, because
-- there are two rules a client cannot be trusted with: tapping twice must not
-- create two overlapping windows (discovery would then count the player twice),
-- and a window must land in the near future rather than in 2030.

create or replace function public.record_availability_ping(
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_window_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception using errcode = 'P0001', message = 'Ping needs a start before its end';
  end if;

  if p_ends_at - p_starts_at > interval '12 hours' then
    raise exception using errcode = 'P0001', message = 'Ping window is too long';
  end if;

  -- A two-hour grace behind `now()` so the current block can still be pinged
  -- after it has started; nothing beyond a fortnight, which is not a plan.
  if p_starts_at < now() - interval '2 hours'
     or p_starts_at > now() + interval '14 days' then
    raise exception using errcode = 'P0001', message = 'Ping window is out of range';
  end if;

  -- Idempotent by overlap rather than by exact match: two taps on adjacent
  -- blocks are one continuous availability, and a duplicate row would make the
  -- same player look like two openings in discovery.
  select aw.id
  into v_window_id
  from public.availability_windows as aw
  where aw.user_id = v_user_id
    and aw.is_recurring = false
    and aw.starts_at is not null
    and aw.ends_at is not null
    and tstzrange(aw.starts_at, aw.ends_at) && tstzrange(p_starts_at, p_ends_at)
  limit 1;

  if v_window_id is not null then
    return v_window_id;
  end if;

  -- `weekday` must stay null: the table's CHECK constraint separates the one-off
  -- shape from the recurring one by exactly that.
  insert into public.availability_windows (user_id, starts_at, ends_at, is_recurring)
  values (v_user_id, p_starts_at, p_ends_at, false)
  returning id into v_window_id;

  return v_window_id;
end;
$$;

revoke all on function public.record_availability_ping(timestamptz, timestamptz) from public, anon;
grant execute on function public.record_availability_ping(timestamptz, timestamptz) to authenticated;

/**
 * Adds `availability_ping_sent` to the client-event allowlist, plus the two prop
 * keys it needs. Extending the allowlist requires a migration by design — that is
 * what forces the privacy question to be asked for each new event.
 */
create or replace function public.record_client_event(
  p_event text,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_props jsonb;
  v_key text;
  v_value jsonb;
  v_recent integer;
begin
  -- Deliberately not assert_marketplace_caller(): that requires a completed
  -- onboarding (via assert_discovery_caller_eligible), and onboarding drop-off is
  -- the first thing this table exists to measure.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_event is null or p_event <> all (array[
    'onboarding_step_viewed',
    'push_permission_prompted',
    'discover_viewed',
    'create_step_viewed',
    'create_abandoned',
    'rematch_offered',
    'rematch_started',
    'rematch_published',
    'availability_ping_sent'
  ]) then
    raise exception using errcode = 'P0001', message = 'Unknown client event';
  end if;

  v_props := coalesce(p_props, '{}'::jsonb);

  if jsonb_typeof(v_props) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Event props must be an object';
  end if;

  for v_key, v_value in select * from jsonb_each(v_props)
  loop
    if v_key <> all (array[
      'step',
      'step_index',
      'surface',
      'segment',
      'filters_active',
      'result_count',
      'is_empty',
      'granted',
      'can_ask_again',
      'opponent_count',
      'hours_since_prior',
      'day_part',
      'day_offset'
    ]) then
      raise exception using errcode = 'P0001',
        message = format('Prop %s is not on the allowlist', v_key);
    end if;

    if jsonb_typeof(v_value) not in ('string', 'number', 'boolean') then
      raise exception using errcode = 'P0001',
        message = format('Prop %s must be a scalar', v_key);
    end if;

    -- Short snake_case tokens only, and they must start with a letter. That
    -- leaves room for 'hub' or 'players' while rejecting an email, a display
    -- name, or a phone number smuggled into a string prop.
    if jsonb_typeof(v_value) = 'string'
       and (v_value #>> '{}') !~ '^[a-z][a-z0-9_]{0,31}$' then
      raise exception using errcode = 'P0001',
        message = format('Prop %s must be a short snake_case token', v_key);
    end if;
  end loop;

  -- A runaway render loop must not be able to fill the table. Dropped silently
  -- rather than raised: analytics must never surface an error to a player.
  select count(*)
  into v_recent
  from public.client_events as ce
  where ce.user_id = v_user_id
    and ce.created_at > now() - interval '1 hour';

  if v_recent >= 300 then
    return;
  end if;

  insert into public.client_events (user_id, event, props)
  values (v_user_id, p_event, v_props);
end;
$$;

revoke all on function public.record_client_event(text, jsonb) from public, anon;
grant execute on function public.record_client_event(text, jsonb) to authenticated;
