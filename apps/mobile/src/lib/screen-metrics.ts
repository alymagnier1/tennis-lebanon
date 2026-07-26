import { spacing, typography } from "@tennis-lebanon/ui";

/** Widths at or below iPhone SE / small Android (portrait). */
export const NARROW_SCREEN_WIDTH = 360;

export function isNarrowScreen(width: number): boolean {
  return width < NARROW_SCREEN_WIDTH;
}

export function horizontalScreenPadding(width: number): number {
  return isNarrowScreen(width) ? spacing.lg : spacing.xl;
}

export function screenTitleFontSize(width: number): number {
  return isNarrowScreen(width) ? typography.size.xl : typography.size["2xl"];
}
