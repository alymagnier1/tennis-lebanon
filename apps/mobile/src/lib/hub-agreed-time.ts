import type { MatchHubCard, MatchHubTimeOption } from "@tennis-lebanon/api";

/** Agreed hour for hub heroes — prefers the dedicated hub fields. */
export function resolveHubAgreedStartsAt(
  hub: Pick<MatchHubCard, "agreed_starts_at" | "selected_time_option_id">,
  proposedTimes: MatchHubTimeOption[],
): string | null {
  if (hub.agreed_starts_at) return hub.agreed_starts_at;

  if (!hub.selected_time_option_id) return null;
  const selected = proposedTimes.find(
    (slot) => slot.id === hub.selected_time_option_id,
  );
  return selected?.starts_at ?? null;
}

/** Earliest proposed slot — preview only until the group agrees. */
export function resolveHubEarliestProposedStartsAt(
  proposedTimes: MatchHubTimeOption[],
): string | null {
  if (proposedTimes.length === 0) return null;
  let earliest = proposedTimes[0]!;
  for (let i = 1; i < proposedTimes.length; i += 1) {
    const slot = proposedTimes[i]!;
    if (slot.starts_at < earliest.starts_at) earliest = slot;
  }
  return earliest.starts_at;
}

/**
 * Time shown in the vs hero: locked booking, then agreed slot, then earliest
 * proposed option as a preview while voting is still open.
 */
export function resolveHubHeroStartsAt(
  hub: Pick<MatchHubCard, "agreed_starts_at" | "selected_time_option_id">,
  proposedTimes: MatchHubTimeOption[],
  bookingStartsAt?: string | null,
): string | null {
  if (bookingStartsAt) return bookingStartsAt;
  return (
    resolveHubAgreedStartsAt(hub, proposedTimes) ??
    resolveHubEarliestProposedStartsAt(proposedTimes)
  );
}
