/** Extra space below the status bar on stack screens with a back button. */
export const STACK_SCREEN_TOP_GAP = 12;

/**
 * Top padding for create-match, onboarding, match hub, and similar stack pages.
 * Keep this shared so hub/chat do not drift from create/onboarding.
 */
export function stackScreenTopPadding(safeAreaTop: number): number {
  return safeAreaTop + STACK_SCREEN_TOP_GAP;
}
