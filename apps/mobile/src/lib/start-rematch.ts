import { getMatchHub } from "@tennis-lebanon/api";
import type { RematchSurface } from "./analytics";
import { resolveRematchOpponents } from "./rematch-draft";

/**
 * Starting a rematch from Home or the Completed list.
 *
 * Those surfaces hold a `CompletedMatchRow`, which carries `opponent_names` as a
 * display string and no user ids, no play intent, no skill range and no zones —
 * so a create draft cannot be built from it. The hub has all of it, so the hub is
 * fetched on tap and `beginRematch` is reused unchanged. That is one round trip
 * in exchange for not widening `list_my_completed_matches`, which four screens
 * already depend on.
 *
 * Doubles deliberately does not guess. With more than one opponent there is no
 * single "play them again", so the caller is told to send the player to the hub,
 * where the card already renders one button per opponent.
 */

export type StartRematchOutcome =
  | { kind: "ready"; opponentUserId: string; opponentName: string }
  /** Several opponents — send them to the hub to choose. */
  | { kind: "needsChoice" }
  /** Nobody left to play: everyone else withdrew or was removed. */
  | { kind: "unavailable" };

export async function resolveRematchTarget(input: {
  client: Parameters<typeof getMatchHub>[0];
  matchId: string;
  viewerUserId: string;
}): Promise<{
  outcome: StartRematchOutcome;
  hub: Awaited<ReturnType<typeof getMatchHub>>;
}> {
  const hub = await getMatchHub(input.client, input.matchId);
  const opponents = resolveRematchOpponents(
    hub.participants,
    input.viewerUserId,
  );

  if (opponents.length === 0) {
    return { outcome: { kind: "unavailable" }, hub };
  }

  if (opponents.length > 1) {
    return { outcome: { kind: "needsChoice" }, hub };
  }

  const opponent = opponents[0]!;
  return {
    outcome: {
      kind: "ready",
      opponentUserId: opponent.userId,
      opponentName: opponent.displayName,
    },
    hub,
  };
}

export type { RematchSurface };
