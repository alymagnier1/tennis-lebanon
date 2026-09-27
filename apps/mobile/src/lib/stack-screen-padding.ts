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
 * `useSafeAreaInsets().bottom` can report `0` on a phone that is actually
 * showing the classic 3-button Android navigation bar. Confirmed on the
 * founder's phone (2026-09-27): the tab bar, the invite page's buttons, the
 * match hub's action bar and the create-match footer all sat flush against
 * the on-screen nav buttons, with no gap at all -- every one of them was
 * trusting `insets.bottom` for that clearance.
 *
 * Every sticky bottom control floors through this instead of using the inset
 * directly. A genuine `0` (gesture navigation, iOS with a home button) is
 * indistinguishable from the bug from inside the app, so the floor applies
 * whenever the inset reads as missing -- it only ever adds space, never
 * removes the breathing room a screen already asks for on top of it.
 */
export const ANDROID_NAV_FALLBACK_BOTTOM = 48;

/** Bottom inset for sticky footers, tab bars and stack-screen bottoms. */
export function stackScreenBottomPadding(safeAreaBottom: number): number {
  return safeAreaBottom > 0 ? safeAreaBottom : ANDROID_NAV_FALLBACK_BOTTOM;
}
