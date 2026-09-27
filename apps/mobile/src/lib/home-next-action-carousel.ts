/** Gap between Home next-action cards in the snap carousel. */
export const HOME_NEXT_ACTION_GAP = 12;
/** How much of the following card peeks so swipe is discoverable. */
export const HOME_NEXT_ACTION_PEEK = 20;

export function homeNextActionCardWidth(contentWidth: number): number {
  if (contentWidth <= 0) return 0;
  return Math.max(0, contentWidth - HOME_NEXT_ACTION_PEEK);
}

export function homeNextActionSnapInterval(cardWidth: number): number {
  return cardWidth + HOME_NEXT_ACTION_GAP;
}

export function homeNextActionSnapOffsets(
  count: number,
  cardWidth: number,
): number[] {
  const interval = homeNextActionSnapInterval(cardWidth);
  const pages = Math.max(0, count);
  const offsets: number[] = [];
  for (let index = 0; index < pages; index += 1) {
    offsets.push(index * interval);
  }
  return offsets;
}

/**
 * Strip padding after the last card. Without it the last snap offset sits one
 * peek past the scrollable end, and the snap stops dead against the edge
 * instead of easing in.
 */
export const HOME_NEXT_ACTION_END_PADDING = HOME_NEXT_ACTION_PEEK;

/**
 * Stops for dot `index`: 1 while its card is snapped, 0 a full page away.
 * Mirrored for the negative offsets RTL reports on web.
 */
export function homeNextActionDotProgressRange(
  index: number,
  cardWidth: number,
): { inputRange: number[]; outputRange: number[] } {
  const interval = homeNextActionSnapInterval(cardWidth);
  const at = index * interval;
  if (index === 0) {
    return { inputRange: [-interval, 0, interval], outputRange: [0, 1, 0] };
  }
  return {
    inputRange: [
      -at - interval,
      -at,
      -at + interval,
      at - interval,
      at,
      at + interval,
    ],
    outputRange: [0, 1, 0, 0, 1, 0],
  };
}

export function homeNextActionPageIndex(
  offsetX: number,
  cardWidth: number,
  count: number,
): number {
  if (count <= 0 || cardWidth <= 0) return 0;
  const interval = homeNextActionSnapInterval(cardWidth);
  const raw = Math.round(Math.abs(offsetX) / interval);
  return Math.min(count - 1, Math.max(0, raw));
}
