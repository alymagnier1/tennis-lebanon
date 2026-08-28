export type HomeFirstPlayInput = {
  hasHeroAction: boolean;
  upcomingCount: number;
  openMatchCount: number;
  freeSlotCount: number;
  openMatchesReady: boolean;
  freeSlotsReady: boolean;
  availabilityReady: boolean;
  openMatchesFailed: boolean;
  freeSlotsFailed: boolean;
  availabilityFailed: boolean;
};

/**
 * One Home empty when there is nothing to list and no next action.
 * Hours and clubs live on the next-action carousel, not this empty.
 */
export function homeFirstPlayKind(input: HomeFirstPlayInput): "play" | null {
  if (input.hasHeroAction) return null;
  if (input.upcomingCount > 0) return null;
  if (input.openMatchCount > 0) return null;
  if (input.freeSlotCount > 0) return null;
  if (
    !input.openMatchesReady ||
    !input.freeSlotsReady ||
    !input.availabilityReady
  ) {
    return null;
  }
  if (input.openMatchesFailed || input.freeSlotsFailed) return null;
  return "play";
}

export function shouldShowHomeFirstPlayEmpty(
  input: HomeFirstPlayInput,
): boolean {
  return homeFirstPlayKind(input) !== null;
}
