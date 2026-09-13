/**
 * Copy key for a failed `join_match`.
 *
 * Shared by the hub and the Discover card so the two cannot drift. A generic
 * "could not join" is close to useless for the two failures a player can
 * actually do something about: a clashing hour is fixed by leaving the other
 * match, and a full match is fixed by finding another one. Anything else stays
 * generic rather than guessing.
 */
export function joinErrorKey(error: unknown): string {
  const message = errorMessage(error);

  if (message.includes("match_time_conflict")) {
    return "matches.hub.joinTimeConflict";
  }
  if (message.includes("match_full")) {
    return "matches.hub.joinFull";
  }
  return "matches.hub.joinError";
}

/**
 * Copy key for a failed `respond_to_join_request`.
 *
 * Separate from `joinErrorKey` because the voices are opposite: the joiner is
 * told the match filled up before they got in, the host is told their own match
 * is already full. `match_full` is the one failure a host sees routinely —
 * nothing declines a pending request when the roster fills, so it is still
 * sitting there with an Approve button on it — and it rendered as the generic
 * "We could not update this request", which names no cause and suggests a
 * retry that cannot work.
 */
export function respondRequestErrorKey(error: unknown): string {
  return errorMessage(error).includes("match_full")
    ? "matches.hub.respondFull"
    : "matches.hub.respondError";
}

/**
 * supabase-js rejects with a plain `PostgrestError` object, not an `Error`, so
 * an `instanceof` check silently downgrades every database failure to the
 * generic copy. Same trap `matchInviteErrorKey` documents in `invite-link.ts`.
 */
function errorMessage(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown }).message
      : error;

  return typeof message === "string" ? message : "";
}
