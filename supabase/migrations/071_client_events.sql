-- Product analytics for what SQL cannot see from the lifecycle tables.
--
-- Almost every retention question in docs/PILOT_OPERATIONS.md is answerable from
-- matches, match_participants, bookings and match_court_requests. Three are not:
-- where onboarding loses people, how often Discover returns an empty room, and
-- where the create flow is abandoned. Those are screen-level facts the database
-- never witnesses, and they are exactly where the audit predicts the losses are.
--
-- Deliberately NOT audit_events. That table is the operational and moderation
-- trail for bookings, attendance, disputes and reports, it is read by operators,
-- and it carries its own retention policy (account life + 12 months per
-- docs/TESTING_SECURITY.md). Mixing product analytics into it would bloat a
-- table people rely on and blur two different retention rules.
--
-- No vendor SDK: writing to Postgres means no consent surface, no third-party
-- processor, and no new privacy review.

create table public.client_events (
  -- bigint identity rather than uuid: this is append-only and high volume, so a
  -- monotonic key is cheaper to index and gives natural ordering for free.
  id bigint generated always as identity primary key,
  -- Cascade matters for privacy: a deletion request removes the profile, which
  -- removes the events with it.
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index client_events_event_idx on public.client_events (event, created_at desc);
create index client_events_user_idx on public.client_events (user_id, created_at desc);

-- RLS on, no policies, no grants. Writes go through the security-definer RPC
-- below; reads happen server-side with the service role, which bypasses RLS.
-- No SELECT policy is created on purpose -- a policy with no accompanying grant
-- is unreachable and reads as protection it is not providing.
alter table public.client_events enable row level security;
revoke all on table public.client_events from anon, authenticated;

/**
 * Records one product-analytics event for the calling user.
 *
 * Both the event name and every prop key are allowlisted here, in SQL, so the
 * privacy rule in CLAUDE.md -- no names, phones, emails, chat bodies, notes,
 * tokens or precise location -- is enforced by the database and not by whoever
 * is editing the client next. Adding an event therefore needs a migration, which
 * is the point: it forces the privacy question to be asked each time.
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
  -- the first thing this table exists to measure. An authenticated session is the
  -- correct bar for an analytics write.
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
    'rematch_published'
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
      'hours_since_prior'
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
