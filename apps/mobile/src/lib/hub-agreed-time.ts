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
