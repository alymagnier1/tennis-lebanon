-- Internal `security definer` helpers were exposed as RPC endpoints.
--
-- A function in `public` with the default grant is callable by `anon` and
-- `authenticated` through PostgREST. Combined with `security definer`, which
-- runs it with RLS bypassed, that turns an internal helper into a public API
-- with no authorization of its own. Eight had been left that way.
--
-- Found auditing the schema before Phase 1 — the point of doing that while the
-- only data at risk is fictional.
--
-- The one that matters most is `append_booking_event`. It takes `p_actor_id` as
-- a parameter, inserts unconditionally, and checks nothing about its caller, so
-- an authenticated user holding a booking id — which `get_match_hub` hands to
-- every participant — could write booking audit rows attributed to anyone,
-- including club staff. The foreign key stops invented booking ids and nothing
-- else. `CLAUDE.md` requires audit events for bookings and disputes precisely so
-- an operator can reconstruct what happened; an audit trail anyone can write to
-- cannot do that job.
--
-- `match_agreed_starts_at` and `match_agreed_ends_at`, added in `090`, leaked a
-- match's agreed hour to `anon` past the authorization in `get_match_hub`. The
-- rest return booleans about matches and courts, which is a thinner leak but the
-- same mistake.
--
-- None of the eight has a caller outside the database. Every RPC that uses them
-- is itself `security definer`, so all of them keep working. This is the pattern
-- `notify_match_participants` already follows.
--
-- Trigger functions are deliberately untouched: `notify_match_cancelled` and
-- `notify_match_roster_change` keep the default grant, because a trigger
-- function cannot be usefully invoked without OLD and NEW.

revoke all on function public.append_booking_event(
  uuid, public.booking_status, public.booking_status, uuid, text, jsonb
) from public, anon, authenticated;

revoke all on function public.match_agreed_starts_at(uuid)
  from public, anon, authenticated;

revoke all on function public.match_agreed_ends_at(uuid)
  from public, anon, authenticated;

revoke all on function public.court_has_block(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

revoke all on function public.match_all_times_passed_grace(uuid)
  from public, anon, authenticated;

revoke all on function public.match_has_active_booking(uuid)
  from public, anon, authenticated;

revoke all on function public.match_is_stale_warning(uuid)
  from public, anon, authenticated;

revoke all on function public.match_should_expire(uuid)
  from public, anon, authenticated;
