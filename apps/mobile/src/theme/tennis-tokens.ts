/**
 * Mobile-only Figma tennis theme. Do not use in dashboard — shared @tennis-lebanon/ui
 * keeps the blue brand ramp for club web.
 */
export const tennisColors = {
  primary: "#0C382E",
  primaryDark: "#0D1C14",
  lime: "#C8E63B",
  limeText: "#0D1C14",
  background: "#FAF9F6",
  card: "#FFFFFF",
  secondary: "#E3EDE6",
  muted: "#ECF0EE",
  mutedForeground: "#627068",
  border: "#E9EBE8",
  accent: "#C4521A",
  danger: "#B91C1C",
  white: "#FFFFFF",
  heroOverlay: "rgba(255,255,255,0.12)",
  heroBorder: "rgba(255,255,255,0.15)",
} as const;

/**
 * Brand colours that are not semantic status tones.
 *
 * `whatsapp` is the brand green, fine for borders and icons at 3.54:1 on
 * `whatsappFill` (UI boundaries need 3:1). It fails AA as text, so labels use
 * `whatsappText` -- WhatsApp's own dark teal, 6.56:1 on the fill.
 */
export const tennisBrand = {
  whatsapp: "#128C7E",
  whatsappText: "#075E54",
  whatsappFill: "#E3F0EE",
} as const;

/** Ordinal skill-band ramp — separate from match status semantics */
export const tennisSkillBands: Record<string, { fill: string; text: string }> =
  {
    beginner: { fill: "#E8F4EC", text: "#1A6B42" },
    improving: { fill: "#DBF1E2", text: "#0C382E" },
    intermediate: { fill: "#C8E63B", text: "#0D1C14" },
    advanced: { fill: "#FBE8DC", text: "#9A3D0F" },
    competitive: { fill: "#F3E8FF", text: "#5B21B6" },
  };

export type SemanticTone =
  "neutral" | "info" | "positive" | "attention" | "critical" | "actionable";

export const tennisSemantic: Record<
  SemanticTone,
  { fill: string; text: string; border: string }
> = {
  neutral: { fill: "#ECF0EE", text: "#3D4A42", border: "#E9EBE8" },
  info: { fill: "#E3EDE6", text: "#0C382E", border: "#B8D4C4" },
  positive: { fill: "#DBF1E2", text: "#0A6B45", border: "#9FD4B5" },
  attention: { fill: "#FBE8DC", text: "#9A3D0F", border: "#F0C9AE" },
  critical: { fill: "#FBE4E2", text: "#A32E22", border: "#EFB8B2" },
  actionable: { fill: "#C8E63B", text: "#0D1C14", border: "#A8C42E" },
} as const;

/** AA-safe on white for error/destructive copy */
export const tennisDangerText = "#B91C1C";

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

export const tennisType = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  display: 28,
} as const;

/** Title + subtitle pairs and label + hint spacing — use via `tennisTextStyles`. */
export const tennisTypography = {
  titleSubtitleGap: 1,
  labelBodyGap: 4,
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  fieldHint: {
    fontSize: 11,
    lineHeight: 14,
  },
} as const;
