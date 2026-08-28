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
