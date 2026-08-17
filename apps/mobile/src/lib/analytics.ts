import {
  recordClientEvent,
  type ClientEventName,
  type ClientEventProps,
} from "@tennis-lebanon/api";
import { supabase } from "./supabase";

/**
 * Fire-and-forget product analytics.
 *
 * Never throws, never awaits at the call site, never blocks a user action — the
 * same posture as the court-handoff recording in `MatchHubPreferredClubs`. A
 * player trying to find a game must never see an error because a metric failed
 * to save, and a slow insert must never delay a screen.
 *
 * Failures are swallowed rather than reported to Sentry: these fire on ordinary
 * navigation, so a network blip would generate noise proportional to usage
 * rather than information. If events go missing in the pilot, the gap shows up
 * as a hole in the funnel, which is the signal that matters.
 */
export function trackEvent(
  event: ClientEventName,
  props: ClientEventProps = {},
): void {
  void recordClientEvent(supabase, event, props).catch(() => undefined);
}

/**
 * Turns a route path into a step token the SQL allowlist will accept
 * (`^[a-z][a-z0-9_]{0,31}$`). Returns null when the path cannot produce one, so
 * a malformed route drops the event rather than throwing inside a layout.
 *
 * Derived from the route rather than passed in by each screen: the six
 * onboarding steps then need no edits, and a seventh is covered the day it is
 * added.
 */
export function routeStepSlug(
  pathname: string | null | undefined,
): string | null {
  const last = (pathname ?? "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .pop();

  if (!last) {
    return null;
  }

  const slug = last
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  return /^[a-z][a-z0-9_]*$/.test(slug) ? slug : null;
}

/** One onboarding step became visible. Powers step-level drop-off. */
export function trackOnboardingStep(
  pathname: string | null | undefined,
  stepIndex?: number,
): void {
  const step = routeStepSlug(pathname);
  if (!step) {
    return;
  }

  trackEvent("onboarding_step_viewed", {
    step,
    ...(stepIndex === undefined ? {} : { step_index: stepIndex }),
  });
}

/**
 * Discover's empty-room rate — the cold-start canary. `result_count` is a count
 * and `segment` an enum, so nothing here identifies a player.
 */
export function trackDiscoverViewed(input: {
  segment: "players" | "matches";
  resultCount: number;
  filtersActive: number;
}): void {
  trackEvent("discover_viewed", {
    segment: input.segment,
    result_count: input.resultCount,
    filters_active: input.filtersActive,
    is_empty: input.resultCount === 0,
  });
}

/** Where a rematch was offered, started, or published. */
export type RematchSurface = "hub" | "home" | "completed_list";

export function trackRematch(
  stage: "offered" | "started" | "published",
  input: { surface: RematchSurface; opponentCount?: number },
): void {
  trackEvent(`rematch_${stage}` as ClientEventName, {
    surface: input.surface,
    ...(input.opponentCount === undefined
      ? {}
      : { opponent_count: input.opponentCount }),
  });
}
