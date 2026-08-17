import type { RematchContext } from "@tennis-lebanon/api";

/**
 * What the rematch card says above "Play again".
 *
 * The completed match is the north-star event and until now it resolved into a
 * silent status change and a score form. Repetition without celebration does not
 * wire a habit, so this states the milestone plainly — no confetti, no points.
 *
 * Two separate lines because they can be true independently: a pair can have
 * played six times with nothing confirmed, and a first-time pair can have a
 * decided result.
 */

export type RematchContextCopy = {
  /** "That's your 8th match. Your 3rd with Rami." */
  milestone: { key: string; params: Record<string, number | string> } | null;
  /** "You lead 2-1." — omitted entirely when nothing is decided. */
  headToHead: { key: string; params: Record<string, number> } | null;
};

export function buildRematchContextCopy(input: {
  context: RematchContext;
  opponentName: string;
}): RematchContextCopy {
  const { playedTogether, viewerWins, opponentWins, viewerTotalCompleted } =
    input.context;

  const milestone =
    viewerTotalCompleted > 0
      ? {
          key:
            playedTogether > 1
              ? "matches.rematch.milestoneWithPair"
              : "matches.rematch.milestone",
          params: {
            total: viewerTotalCompleted,
            together: playedTogether,
            name: input.opponentName,
          },
        }
      : null;

  // Nothing decided means nothing to claim. A pair who have never confirmed a
  // score sees the milestone alone rather than a hollow "0-0".
  const decided = viewerWins + opponentWins;
  const headToHead =
    decided > 0
      ? {
          key:
            viewerWins > opponentWins
              ? "matches.rematch.headToHeadLead"
              : viewerWins < opponentWins
                ? "matches.rematch.headToHeadTrail"
                : "matches.rematch.headToHeadLevel",
          params: { wins: viewerWins, losses: opponentWins },
        }
      : null;

  return { milestone, headToHead };
}
