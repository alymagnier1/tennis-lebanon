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
  const message = error instanceof Error ? error.message : "";

  if (message.includes("match_time_conflict")) {
    return "matches.hub.joinTimeConflict";
  }
  if (message.includes("match_full")) {
    return "matches.hub.joinFull";
  }
  return "matches.hub.joinError";
}
