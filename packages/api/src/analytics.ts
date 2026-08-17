import type { TennisSupabaseClient } from "./client";

/**
 * Product analytics for the three things the lifecycle tables cannot witness:
 * where onboarding loses people, how often Discover returns an empty room, and
 * where the create flow is abandoned — plus which surface a rematch came from.
 *
 * Both unions below mirror the allowlists in `record_client_event`
 * (migration 071) exactly. The database rejects anything outside them, so these
 * types are a convenience for callers rather than the enforcement boundary — the
 * enforcement is in SQL, where a future client edit cannot quietly widen it.
 */
export const CLIENT_EVENT_NAMES = [
  "onboarding_step_viewed",
  "push_permission_prompted",
  "discover_viewed",
  "create_step_viewed",
  "create_abandoned",
  "rematch_offered",
  "rematch_started",
  "rematch_published",
  "availability_ping_sent",
  "liquidity_signal_viewed",
] as const;

export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

/**
 * Every prop is an integer, boolean, or short snake_case token. No names,
 * phones, emails, chat bodies, notes, tokens or locations — the SQL rejects a
 * string that does not match `^[a-z][a-z0-9_]{0,31}$`, which is what stops an
 * email or a display name being smuggled into a string prop.
 */
export type ClientEventProps = {
  /** Onboarding or create step slug, e.g. `zones`. */
  step?: string;
  step_index?: number;
  /** Where a rematch was offered or started: `hub`, `home`, `completed_list`. */
  surface?: string;
  /** Discover segment: `players` or `matches`. */
  segment?: string;
  filters_active?: number;
  result_count?: number;
  is_empty?: boolean;
  granted?: boolean;
  can_ask_again?: boolean;
  opponent_count?: number;
  hours_since_prior?: number;
  /** `morning`, `afternoon` or `evening` — which block was pinged. */
  day_part?: string;
  /** 0 = today in Beirut, 1 = tomorrow. */
  day_offset?: number;
  /**
   * Other players shown as free in a block: the peak for
   * `liquidity_signal_viewed`, or how many were on offer in the block a
   * `availability_ping_sent` responded to. Tests whether a bigger number
   * actually converts.
   */
  player_count?: number;
};

/**
 * Throws on failure. Callers that must never disrupt a user action should use
 * the mobile `trackEvent` wrapper, which swallows.
 */
export async function recordClientEvent(
  client: TennisSupabaseClient,
  event: ClientEventName,
  props: ClientEventProps = {},
): Promise<void> {
  const { error } = await client.rpc("record_client_event", {
    p_event: event,
    p_props: props,
  });

  if (error) throw error;
}
