/**
 * Base design tokens shared by the mobile app and dashboard.
 * Values are plain data (no React Native / DOM types) so both apps can
 * consume the same source without cross-platform component sharing.
 */

export const colors = {
  brand: {
    50: "#eefdf3",
    100: "#d5f7e1",
    300: "#7de3ac",
    500: "#1f9d55",
    600: "#187e44",
    700: "#136535",
  },
  neutral: {
    0: "#ffffff",
    50: "#f7f8f9",
    100: "#eceef0",
    300: "#c3c8cd",
    500: "#7c8590",
    700: "#454b52",
    900: "#16191c",
  },
  danger: {
    100: "#fde2e1",
    500: "#d1453b",
    700: "#a5342c",
  },
  warning: {
    100: "#fef3cd",
    500: "#c8891b",
  },
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
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
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
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

/** Minimum recommended touch target size (platform accessibility guidance). */
export const minTouchTargetPx = 44;
