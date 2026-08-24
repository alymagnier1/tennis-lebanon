/** Wide enough to read, still peeks the next card on ~390px with 28px screen gutters. */
export const HOME_FREE_PLAYER_CARD_WIDTH = 300;
export const HOME_FREE_PLAYER_CARD_GAP = 12;
export const HOME_FREE_PLAYER_SNAP_INTERVAL =
  HOME_FREE_PLAYER_CARD_WIDTH + HOME_FREE_PLAYER_CARD_GAP;

/**
 * Start offsets for each player card plus the trailing "View all" tile.
 * Interval is card width + strip gap so native snap and CSS scroll-snap stay aligned.
 */
export function homeFreePlayerSnapOffsets(playerCount: number): number[] {
  const count = Math.max(0, playerCount);
  const offsets: number[] = [];
  for (let index = 0; index <= count; index += 1) {
    offsets.push(index * HOME_FREE_PLAYER_SNAP_INTERVAL);
  }
  return offsets;
}
