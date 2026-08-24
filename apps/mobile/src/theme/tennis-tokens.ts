/**
 * Mobile-only Figma tennis theme. Do not use in dashboard — shared @tennis-lebanon/ui
 * keeps the blue brand ramp for club web.
 *
 * `tennisColors` (and sibling palettes) read the active scheme so live style
 * sheets pick up dark mode. Prefer `useTennisTheme()` when a component must
 * re-render on scheme change; module-level StyleSheet.create snapshots values.
 */

export type TennisColorName = keyof typeof tennisColorsLight;

export type TennisColorTokens = { readonly [K in TennisColorName]: string };

export type AppearancePreference = "system" | "light" | "dark";

export type ResolvedAppearance = "light" | "dark";

export const tennisColorsLight = {
  primary: "#0C382E",
  primaryDark: "#0D1C14",
  onPrimary: "#FFFFFF",
  lime: "#C8E63B",
  limeText: "#0D1C14",
  background: "#FAF9F6",
  card: "#FFFFFF",
  secondary: "#E3EDE6",
  muted: "#ECF0EE",
  mutedForeground: "#627068",
  border: "#E9EBE8",
  accent: "#C4521A",
  violet: "#7C3AED",
  onViolet: "#FFFFFF",
  danger: "#B91C1C",
  white: "#FFFFFF",
  heroOverlay: "rgba(255,255,255,0.12)",
  heroBorder: "rgba(255,255,255,0.15)",
} as const;

/**
 * Dark surfaces follow the olive-charcoal canvas (green-black, not yellow-black).
 * CTAs and selected chrome use the mock lavender so lime stays on skill chips.
 */
export const tennisColorsDark = {
  primary: "#8B6DFF",
  primaryDark: "#F3F4F0",
  onPrimary: "#FFFFFF",
  lime: "#C8E63B",
  limeText: "#0D1C14",
  background: "#101408",
  card: "#1C1E19",
  secondary: "#252722",
  muted: "#161814",
  mutedForeground: "#A8AAA4",
  border: "#2E322C",
  accent: "#E07A3D",
  violet: "#8B6DFF",
  onViolet: "#FFFFFF",
  danger: "#F87171",
  white: "#FFFFFF",
  heroOverlay: "rgba(255,255,255,0.08)",
  heroBorder: "rgba(255,255,255,0.12)",
} as const;

/**
 * Brand colours that are not semantic status tones.
 *
 * `whatsapp` is the brand green, fine for borders and icons at 3.54:1 on
 * `whatsappFill` (UI boundaries need 3:1). It fails AA as text, so labels use
 * `whatsappText` -- WhatsApp's own dark teal, 6.56:1 on the fill.
 */
export type TennisBrandTokens = {
  whatsapp: string;
  whatsappText: string;
  whatsappFill: string;
};

export const tennisBrandLight: TennisBrandTokens = {
  whatsapp: "#128C7E",
  whatsappText: "#075E54",
  whatsappFill: "#E3F0EE",
};

export const tennisBrandDark: TennisBrandTokens = {
  whatsapp: "#2DD4BF",
  whatsappText: "#99F6E4",
  whatsappFill: "#14302C",
};

/** Ordinal skill-band ramp — separate from match status semantics */
export const tennisSkillBandsLight: Record<
  string,
  { fill: string; text: string }
> = {
  beginner: { fill: "#E8F4EC", text: "#1A6B42" },
  improving: { fill: "#DBF1E2", text: "#0C382E" },
  intermediate: { fill: "#C8E63B", text: "#0D1C14" },
  advanced: { fill: "#FBE8DC", text: "#9A3D0F" },
  competitive: { fill: "#F3E8FF", text: "#5B21B6" },
};

export const tennisSkillBandsDark: Record<
  string,
  { fill: string; text: string }
> = {
  beginner: { fill: "#143328", text: "#86EFAC" },
  improving: { fill: "#1A3D2E", text: "#BBF7D0" },
  intermediate: { fill: "#C8E63B", text: "#0D1C14" },
  advanced: { fill: "#3A2418", text: "#F4C7A8" },
  competitive: { fill: "#2A1A3A", text: "#E9D5FF" },
};

export type SemanticTone =
  "neutral" | "info" | "positive" | "attention" | "critical" | "actionable";

export type SemanticToneTokens = {
  fill: string;
  text: string;
  border: string;
};

export const tennisSemanticLight: Record<SemanticTone, SemanticToneTokens> = {
  neutral: { fill: "#ECF0EE", text: "#3D4A42", border: "#E9EBE8" },
  info: { fill: "#E3EDE6", text: "#0C382E", border: "#B8D4C4" },
  positive: { fill: "#DBF1E2", text: "#0A6B45", border: "#9FD4B5" },
  attention: { fill: "#FBE8DC", text: "#9A3D0F", border: "#F0C9AE" },
  critical: { fill: "#FBE4E2", text: "#A32E22", border: "#EFB8B2" },
  actionable: { fill: "#C8E63B", text: "#0D1C14", border: "#A8C42E" },
};

export const tennisSemanticDark: Record<SemanticTone, SemanticToneTokens> = {
  neutral: { fill: "#252722", text: "#D4D6D0", border: "#2E322C" },
  info: { fill: "#1A2E28", text: "#C8E63B", border: "#2A4A40" },
  positive: { fill: "#143328", text: "#86EFAC", border: "#1A4A32" },
  attention: { fill: "#3A2418", text: "#F4C7A8", border: "#5A3828" },
  critical: { fill: "#3A1818", text: "#FECACA", border: "#5A2828" },
  actionable: { fill: "#8B6DFF", text: "#FFFFFF", border: "#7A5CF0" },
};

const DANGER_TEXT_LIGHT = "#B91C1C";
const DANGER_TEXT_DARK = "#FCA5A5";

type ActiveTennisTheme = {
  scheme: ResolvedAppearance;
  colors: TennisColorTokens;
  brand: TennisBrandTokens;
  skillBands: Record<string, { fill: string; text: string }>;
  semantic: Record<SemanticTone, SemanticToneTokens>;
  dangerText: string;
};

function themeFor(scheme: ResolvedAppearance): ActiveTennisTheme {
  if (scheme === "dark") {
    return {
      scheme,
      colors: tennisColorsDark,
      brand: tennisBrandDark,
      skillBands: tennisSkillBandsDark,
      semantic: tennisSemanticDark,
      dangerText: DANGER_TEXT_DARK,
    };
  }
  return {
    scheme,
    colors: tennisColorsLight,
    brand: tennisBrandLight,
    skillBands: tennisSkillBandsLight,
    semantic: tennisSemanticLight,
    dangerText: DANGER_TEXT_LIGHT,
  };
}

let activeTheme: ActiveTennisTheme = themeFor("light");

export function getActiveTennisScheme(): ResolvedAppearance {
  return activeTheme.scheme;
}

export function getActiveTennisTheme(): ActiveTennisTheme {
  return activeTheme;
}

export function setActiveTennisScheme(scheme: ResolvedAppearance): void {
  activeTheme = themeFor(scheme);
}

export function resolveAppearance(
  preference: AppearancePreference,
  systemScheme: ResolvedAppearance | null | undefined,
): ResolvedAppearance {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return systemScheme === "dark" ? "dark" : "light";
}

function live<T extends object>(read: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const current = read();
      const value = Reflect.get(current, prop, current);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(current);
      }
      return value ?? Reflect.get(current, prop, receiver);
    },
    ownKeys() {
      return Reflect.ownKeys(read());
    },
    getOwnPropertyDescriptor(_target, prop) {
      const desc = Reflect.getOwnPropertyDescriptor(read(), prop);
      if (!desc) return undefined;
      return { ...desc, configurable: true };
    },
  });
}

/** Active colour tokens. Reads the current scheme (light until ThemeProvider hydrates). */
export const tennisColors: TennisColorTokens = live(() => activeTheme.colors);

export const tennisBrand: TennisBrandTokens = live(() => activeTheme.brand);

export const tennisSkillBands: Record<string, { fill: string; text: string }> =
  live(() => activeTheme.skillBands);

export const tennisSemantic: Record<SemanticTone, SemanticToneTokens> = live(
  () => activeTheme.semantic,
);

export function getTennisDangerText(): string {
  return activeTheme.dangerText;
}

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
  /** Home (and similar) title row → first content, not card-to-card. */
  sectionTitleContent: 8,
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
