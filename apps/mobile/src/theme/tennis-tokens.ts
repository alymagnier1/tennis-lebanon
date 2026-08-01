/**
 * Mobile-only Figma tennis theme. Do not use in dashboard — shared @tennis-lebanon/ui
 * keeps the blue brand ramp for club web.
 */
export const tennisColors = {
  primary: "#0F5132",
  primaryDark: "#0D1C14",
  lime: "#C8E63B",
  limeText: "#0D1C14",
  background: "#F3F6F4",
  card: "#FFFFFF",
  secondary: "#E3EDE6",
  muted: "#ECF0EE",
  mutedForeground: "#627068",
  border: "#D8E4DC",
  accent: "#C4521A",
  danger: "#ef4444",
  white: "#FFFFFF",
  heroOverlay: "rgba(255,255,255,0.12)",
  heroBorder: "rgba(255,255,255,0.15)",
} as const;

export const tennisRadii = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  hero: 24,
  pill: 20,
} as const;

export const tennisSpacing = {
  screenX: 28,
  screenBottom: 48,
  section: 20,
} as const;
