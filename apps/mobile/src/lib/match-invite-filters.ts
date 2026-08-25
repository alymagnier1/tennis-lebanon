import type { MatchHubCard, MatchHubTimeOption } from "@tennis-lebanon/api";

export type MatchTimeWindow = { freeFrom: string; freeTo: string };

/**
 * The window a candidate has to be free in to be any use to this match.
 *
 * Three cases, in order. A fixed-time match knows its hour, so the window is
 * that option exactly -- read off `proposed_times` rather than assuming a
 * duration, because a 60 and a 120 minute match are different asks. A flexible
 * match still collecting votes has no single hour, so the window spans every
 * option on the table: a player free for any of them could still end up in the
 * match, and excluding them would pre-empt a vote that has not happened.
 *
 * Neither means no window, which is the behaviour this screen had before: a
 * draft with no times yet should list everyone rather than nobody.
 */
export function matchTimeWindow(hub: MatchHubCard): MatchTimeWindow | null {
  const options: MatchHubTimeOption[] = hub.proposed_times ?? [];

  if (hub.agreed_starts_at) {
    const agreed = options.find(
      (option) => option.starts_at === hub.agreed_starts_at,
    );
    if (agreed) {
      return { freeFrom: agreed.starts_at, freeTo: agreed.ends_at };
    }
    // The agreed hour outlived its option row -- `agreed_starts_at` survives
    // filtering that `proposed_times` does not. Nothing to read a duration
    // from, so fall through to the span rather than inventing one.
  }

  if (options.length === 0) {
    return null;
  }

  let earliest = options[0]!.starts_at;
  let latest = options[0]!.ends_at;
  for (const option of options) {
    if (option.starts_at < earliest) earliest = option.starts_at;
    if (option.ends_at > latest) latest = option.ends_at;
  }

  return { freeFrom: earliest, freeTo: latest };
}
