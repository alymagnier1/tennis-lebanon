/**
 * Base design tokens shared by the mobile app and dashboard.
 * Values are plain data (no React Native / DOM types) so both apps can
 * consume the same source without cross-platform component sharing.
 *
 * Contrast: every ratio quoted below is against white (#ffffff) and was
 * calculated, not estimated. WCAG AA needs 4.5:1 for body text and 3:1 for
 * large text and UI component boundaries.
 */

export const colors = {
  /**
   * Primary blue. The previous ramp topped out at #2ab1f5, which gives white
   * text only 2.4:1 — it failed AA on the primary button and read as
   * disabled. Everything from 600 down now carries white text safely.
   *
   * 500 is for borders, focus rings and switch tracks (3.6:1 — fine for UI
   * boundaries, not for text). Use 600 or 700 whenever text is involved.
   */
  brand: {
    50: "#eff8ff",
    100: "#d8ecfd",
    200: "#b4dcfb",
    300: "#7cc4fa",
    400: "#3aa9f0",
    500: "#1a8fd0", // 3.6:1 — UI boundaries only
    600: "#0d76b0", // 4.96:1 — button fills, links, active text
    700: "#0a6c9e", // 5.75:1 — pressed states, emphasis
    800: "#08557a",
    900: "#063f5b",
  },
  neutral: {
    0: "#ffffff",
    50: "#f7f8f9",
    100: "#eceef0",
    200: "#dcdfe3",
    300: "#c3c8cd",
    500: "#6b7480", // 4.73:1 — was #7c8590 at 3.69:1, which failed AA
    600: "#565e69",
    700: "#454b52",
    800: "#2b3037",
    900: "#16191c",
  },
  /**
   * Confirmation and completion. Previously absent, so success states either
   * borrowed brand blue or went unstyled.
   */
  success: {
    50: "#eefaf4",
    100: "#d0f0e1",
    500: "#12996a",
    600: "#0f7a52", // 5.35:1
    700: "#0b5c3e",
  },
  /**
   * Clay court accent. A warm counterpoint so not every emphasis in the app
   * is the same blue — reserved for "your turn" moments and highlights.
   */
  accent: {
    50: "#fdf3ee",
    100: "#fadfd0",
    500: "#e2662c",
    600: "#c2410c", // 5.18:1
    700: "#9a340a",
  },
  danger: {
    100: "#fde2e1",
    500: "#d1453b",
    700: "#a5342c",
  },
  warning: {
    100: "#fef3cd",
    500: "#c8891b",
    700: "#8a5e12",
  },
} as const;

/**
 * Semantic aliases. Prefer these in components: they say what a colour is
 * for, so a palette change does not mean auditing every screen.
 */
export const semantic = {
  surface: colors.neutral[0],
  surfaceSunken: colors.neutral[50],
  surfaceTint: colors.brand[50],
  border: colors.neutral[200],
  borderStrong: colors.neutral[300],
  textPrimary: colors.neutral[900],
  textSecondary: colors.neutral[700],
  textTertiary: colors.neutral[500],
  textOnBrand: colors.neutral[0],
  interactive: colors.brand[600],
  interactivePressed: colors.brand[700],
  focusRing: colors.brand[500],
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/**
 * Elevation. There were no shadow tokens at all, so every card fell back to a
 * 1px near-white border on white — the main reason surfaces read as flat
 * outlined boxes. Each level carries both the iOS shadow properties and the
 * Android `elevation` value.
 */
export const elevation = {
  none: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sm: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

export const typography = {
  fontFamily: {
    base: "System",
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    "2xl": 32,
  },
  /**
   * Line heights were previously hardcoded per style (20 here, 22 there).
   * Keyed to the size scale so blocks of text set consistently.
   */
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 26,
    xl: 30,
    "2xl": 38,
  },
  letterSpacing: {
    tight: -0.4,
    normal: 0,
    wide: 0.4,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

/** Minimum recommended touch target size (platform accessibility guidance). */
export const minTouchTargetPx = 44;
