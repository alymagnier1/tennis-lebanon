export type MatchCardHeadlineInput = {
  opponentNames?: string | null;
  status: string;
  participantCount: number;
  capacity: number;
};

const PAST_RECRUITING_STATUSES = new Set([
  "full",
  "ready_to_book",
  "booking_pending",
  "confirmed",
  "in_progress",
]);

export function matchCardOpponentLabel(
  opponentNames: string | null | undefined,
): string | undefined {
  const trimmed = opponentNames?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function matchCardHasRosterOpponent(input: MatchCardHeadlineInput): boolean {
  return (
    input.participantCount > 1 ||
    input.participantCount >= input.capacity ||
    PAST_RECRUITING_STATUSES.has(input.status)
  );
}

export function resolveMatchCardOpponent(
  translate: (key: string, options?: { name: string }) => string,
  input: MatchCardHeadlineInput,
): string | undefined {
  const opponent = matchCardOpponentLabel(input.opponentNames);
  if (opponent) {
    return opponent;
  }

  if (matchCardHasRosterOpponent(input)) {
    return translate("playerProfile.unknownOpponent");
  }

  return undefined;
}

export function buildMatchCardHeadline(
  translate: (key: string, options?: { name: string }) => string,
  input: MatchCardHeadlineInput,
): string {
  const opponent = resolveMatchCardOpponent(translate, input);
  if (opponent) {
    return translate("matches.list.youVsOpponent", { name: opponent });
  }

  return translate("matches.list.seekingOpponent");
}

/** @deprecated Use buildMatchCardHeadline with roster context instead. */
export function buildYouVsHeadline(
  translate: (key: string, options?: { name: string }) => string,
  opponentNames: string | null | undefined,
  fallback: string,
): string {
  const opponent = matchCardOpponentLabel(opponentNames);
  return opponent
    ? translate("matches.list.youVsOpponent", { name: opponent })
    : fallback;
}
