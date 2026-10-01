/** Extra space below the status bar on stack screens with a back button. */
export const STACK_SCREEN_TOP_GAP = 12;

/**
 * Top padding for create-match, onboarding, match hub, and similar stack pages.
 * Keep this shared so hub/chat do not drift from create/onboarding.
 */
export function stackScreenTopPadding(safeAreaTop: number): number {
  return safeAreaTop + STACK_SCREEN_TOP_GAP;
}

/**
 * Bottom padding for a control pinned to the bottom of the screen: clear the
 * system navigation area, then leave `gap` so the control never rests on the
 * bar's top edge.
 *
 * `Math.max(safeAreaBottom, gap)` looked equivalent and is not. Wherever the
 * bar is taller than the gap it adds nothing, so on the founder's phone
 * (3-button navigation, a 48dp bar) the tab bar, the invite page's buttons and
 * the match hub's action bar all sat exactly on the bar (2026-09-27).
 *
 * Adapts to every phone: no bar (hidden, iPhone SE) gets `gap`, as before; a
 * gesture handle or iPhone home indicator gets its inset plus `gap`; a
 * 3-button bar gets its full height plus `gap`. Pass the old minimum as `gap`
 * and a phone without a bar sees no change at all.
 */
export function pinnedBottomPadding(
  safeAreaBottom: number,
  gap: number,
): number {
  return safeAreaBottom + gap;
}
