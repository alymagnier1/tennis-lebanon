/**
 * Paging rules for `SnapStrip`, the Android drag-and-settle strip.
 *
 * React Native's Android snapping (`snapToOffsets`) runs an ordinary fling
 * clamped to the next snap point, and adds a speed boost of ten times the
 * remaining distance. A fast swipe is still moving quickly when the clamp is
 * hit, so the card stops dead (the founder's "snappy", 2026-09-27). The strip
 * settles itself instead, with a curve that starts at the release speed.
 *
 * Positions are offsets along the strip: 0 is the first card, larger values
 * reveal later cards. Velocities are in px/ms, positive toward later cards.
 */

/** Release speed above which a swipe pages in its direction however short it was. */
export const SNAP_FLING_VX = 0.3;
export const SNAP_SETTLE_MIN_MS = 220;
export const SNAP_SETTLE_MAX_MS = 420;
/** A release with no speed eases in over this long. */
export const SNAP_SETTLE_IDLE_MS = 300;

/**
 * The page to settle on. A fling goes to the next page in its direction from
 * where the strip is now (never skipping one); a slow release goes to the
 * nearest page.
 */
export function snapStripTargetIndex(input: {
  offsets: number[];
  position: number;
  velocity: number;
}): number {
  const { offsets, position, velocity } = input;
  if (offsets.length === 0) return 0;
  const last = offsets.length - 1;

  if (velocity >= SNAP_FLING_VX) {
    const ahead = offsets.findIndex((offset) => offset > position + 1);
    return ahead === -1 ? last : ahead;
  }
  if (velocity <= -SNAP_FLING_VX) {
    for (let index = last; index >= 0; index -= 1) {
      if (offsets[index]! < position - 1) return index;
    }
    return 0;
  }

  let nearest = 0;
  for (let index = 1; index <= last; index += 1) {
    if (
      Math.abs(offsets[index]! - position) <
      Math.abs(offsets[nearest]! - position)
    ) {
      nearest = index;
    }
  }
  return nearest;
}

/**
 * How long the settle takes. An ease-out cubic starts at three times its
 * average speed, so `3 * distance / speed` makes the strip leave the finger at
 * the speed it was released with, then slow smoothly to a stop.
 */
export function snapStripSettleMs(distance: number, velocity: number): number {
  const speed = Math.abs(velocity);
  if (speed < 0.05) return SNAP_SETTLE_IDLE_MS;
  const ms = (3 * Math.abs(distance)) / speed;
  return Math.min(SNAP_SETTLE_MAX_MS, Math.max(SNAP_SETTLE_MIN_MS, ms));
}

/**
 * Resistance past either end: the strip follows the finger less and less, as
 * a bounce does on iOS. Returns the visible overshoot for a finger overshoot.
 */
export function snapStripRubberBand(overshoot: number, span: number): number {
  if (span <= 0) return 0;
  const magnitude = Math.abs(overshoot);
  const resisted = (1 - 1 / ((magnitude * 0.55) / span + 1)) * span;
  return Math.sign(overshoot) * resisted;
}

/** Where a drag puts the strip, with resistance outside [first, last]. */
export function snapStripDragPosition(input: {
  raw: number;
  first: number;
  last: number;
  span: number;
}): number {
  const { raw, first, last, span } = input;
  if (raw < first) return first + snapStripRubberBand(raw - first, span);
  if (raw > last) return last + snapStripRubberBand(raw - last, span);
  return raw;
}
