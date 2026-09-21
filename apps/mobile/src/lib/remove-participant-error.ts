/**
 * Copy key for a failed `remove_match_participant`.
 *
 * The host already chose a player and a reason; the useful failures are the
 * ones they cannot retry: the hour has started, or the row is no longer
 * accepted. Anything else stays generic.
 */
export function removeParticipantErrorKey(error: unknown): string {
  const message = errorMessage(error);

  if (message.includes("match_already_started")) {
    return "matches.hub.removeErrorStarted";
  }
  if (message.includes("participant_not_accepted")) {
    return "matches.hub.removeErrorNotAccepted";
  }
  if (message.includes("match_not_removable")) {
    return "matches.hub.removeErrorNotRemovable";
  }
  return "matches.hub.removeError";
}

function errorMessage(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown }).message
      : error;

  return typeof message === "string" ? message : "";
}
