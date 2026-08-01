/** Keep in sync with `TennisTabBar` layout (for full-screen overlays only). */
const TAB_BAR_TOP_PADDING = 8;
const TAB_BAR_MIN_HEIGHT = 48;
const TAB_BAR_BOTTOM_PADDING_MIN = 8;

export function bottomTabBarHeight(safeAreaBottom: number): number {
  return (
    TAB_BAR_TOP_PADDING +
    TAB_BAR_MIN_HEIGHT +
    Math.max(safeAreaBottom, TAB_BAR_BOTTOM_PADDING_MIN)
  );
}

/** Tab screens render above the tab bar — anchor FAB to the content bottom only. */
export function profileFabBottomOffset(_safeAreaBottom = 0): number {
  return 12;
}
