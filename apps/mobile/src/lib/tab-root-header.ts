/** Space between the status bar and the first tab chips on Discover / Matches. */
export const TAB_ROOT_HEADER_GAP = 8;

export function tabRootHeaderPaddingTop(safeAreaTop: number): number {
  return safeAreaTop + TAB_ROOT_HEADER_GAP;
}
