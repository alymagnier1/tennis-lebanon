/**
 * Clone-end looping for a snap carousel: [last, ...items, first].
 * The real first item sits at clone index 1 so a left swipe from the start
 * lands on the trailing clone, which we then jump to the real last.
 */

export function loopingCarouselItems<T>(items: readonly T[]): T[] {
  if (items.length < 2) return [...items];
  return [items[items.length - 1]!, ...items, items[0]!];
}

export function loopingCarouselStartCloneIndex(count: number): number {
  return count < 2 ? 0 : 1;
}

export function loopingCarouselRealIndex(
  cloneIndex: number,
  count: number,
): number {
  if (count <= 1) return 0;
  if (cloneIndex <= 0) return count - 1;
  if (cloneIndex >= count + 1) return 0;
  return cloneIndex - 1;
}

/**
 * When the user settles on a cloned slide, jump to the matching real slide.
 * Returns that clone index, or null when already on a real slide.
 */
export function loopingCarouselJumpCloneIndex(
  cloneIndex: number,
  count: number,
): number | null {
  if (count < 2) return null;
  if (cloneIndex <= 0) return count;
  if (cloneIndex >= count + 1) return 1;
  return null;
}

/** True when the offset is parked on a snap page, not mid-swipe. */
export function loopingCarouselOffsetIsSettled(
  offsetX: number,
  interval: number,
): boolean {
  if (interval <= 0) return false;
  const raw = Math.abs(offsetX) / interval;
  return Math.abs(raw - Math.round(raw)) < 0.02;
}
