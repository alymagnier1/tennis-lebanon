/** Keep in sync with `TennisTabBar` layout (for full-screen overlays only). */
export const TAB_BAR_TOP_PADDING = 12;
export const TAB_BAR_ICON_WELL_HEIGHT = 44;
export const TAB_BAR_LABEL_GAP = 4;
export const TAB_BAR_LABEL_HEIGHT = 13;
export const TAB_BAR_BOTTOM_PADDING_MIN = 8;

export function bottomTabBarHeight(safeAreaBottom: number): number {
  return (
    TAB_BAR_TOP_PADDING +
    TAB_BAR_ICON_WELL_HEIGHT +
    TAB_BAR_LABEL_GAP +
    TAB_BAR_LABEL_HEIGHT +
    Math.max(safeAreaBottom, TAB_BAR_BOTTOM_PADDING_MIN)
  );
}

/** Tab screens render above the tab bar — anchor FAB to the content bottom only. */
export function profileFabBottomOffset(_safeAreaBottom = 0): number {
  return 12;
}
