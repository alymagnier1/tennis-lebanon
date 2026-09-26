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
  // Darkened from #627068, which was 4.34:1 on `secondary`.
  mutedForeground: "#5C6A62",
  border: "#E9EBE8",
  accent: "#C4521A",
  /** Club photo stand-in (clay court) until real images exist. */
  photoPlaceholder: "#E09A5C",
  violet: "#7C3AED",
  /** Violet as *text*; the fill above carries `onViolet`. */
  violetText: "#7C3AED",
  onViolet: "#FFFFFF",
  danger: "#B91C1C",
  /** Soft well behind destructive icons (Settings account rows). */
  dangerSoft: "#FEF0E7",
  white: "#FFFFFF",
  heroOverlay: "rgba(255,255,255,0.12)",
  heroBorder: "rgba(255,255,255,0.15)",
  /** Quiet metadata chips on the vs card — not lime, not pressable. */
  quietFill: "#EFF3EE",
  linkUnderline: "#B8C4BC",
  /**
   * Accent/link text on a normal surface. Same value as `primary` here, but a
   * separate token because dark mode cannot reuse `primary`: a lavender dark
   * enough to carry a white label (#6D4FE0) is too dark to *be* text on a dark
   * surface (3.08:1 on `card`). See the dark palette.
   */
  linkText: "#0C382E",
} as const;

/**
 * Dark surfaces follow the olive-charcoal canvas (green-black, not yellow-black).
 * CTAs and selected chrome use the mock lavender so lime stays on skill chips.
 */
export const tennisColorsDark = {
  /**
   * Fill that carries the white `onPrimary` label. Darkened from the mock's
   * #8B6DFF (2026-08-23), which measured 3.67:1 against white — below AA for a
   * 16px bold button label, which is not WCAG "large text". #6D4FE0 is 5.46:1.
   */
  primary: "#6D4FE0",
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
  /** Warm olive charcoal — same role as light clay, without a glowing orange slab. */
  photoPlaceholder: "#2C2E26",
  // Fill only. White on #8B6DFF was 3.67:1 -- the unread count pill is 11px.
  violet: "#6D4FE0",
  /** Violet as *text*, kept light enough to read on every dark surface. */
  violetText: "#9B80FF",
  onViolet: "#FFFFFF",
  danger: "#F87171",
  /** Soft well behind destructive icons on dark surfaces. */
  dangerSoft: "#3A2420",
  white: "#FFFFFF",
  heroOverlay: "rgba(255,255,255,0.08)",
  heroBorder: "rgba(255,255,255,0.12)",
  quietFill: "#252722",
  linkUnderline: "#4A524C",
  /**
   * Lighter than `primary` on purpose: this is text, not a fill. The smallest
   * step up from #8B6DFF that clears 4.5:1 on every dark surface — #8B6DFF
   * itself falls to 4.12:1 on `secondary`. Worst case here is 4.98:1.
   */
  linkText: "#9B80FF",
} as const;

/**
 * Onboarding hero art — full-bleed grounds, plates, and the ink that sits on
 * them. Deliberately outside `tennisColors`: these are properties of fixed
 * artwork, not of the active scheme, so they must not invert with dark mode.
 *
 * Never use these as a foreground on `card` / `background` / `secondary`. They
 * used to live in both palettes with identical values, which let `heroOnLight`
 * (#0D1C14) be used as body ink — invisible at 1.05:1 on the dark card. Keeping
 * them in their own namespace makes that mistake a type error instead.
 */
export const tennisHeroArt = {
  heroGreen: "#0C382E",
  heroGreenDeep: "#0A2D25",
  heroPlate: "#3F7A5C",
  heroInk: "#0A1F18",
  heroMint: "#A7C7AF",
  heroClay: "#E8DCC2",
  /** Ink for text sitting on `heroClay` / `heroPlate`, never on a scheme surface. */
  heroOnLight: "#0D1C14",
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

/**
 * Match chat, styled after WhatsApp: a warm wallpaper, pale-green bubbles for
 * the viewer, plain bubbles for everyone else. Every text colour here clears
 * 4.5:1 on the surface it sits on (checked 2026-09-26; lowest is a sender name
 * at 5.28:1 on a light bubble). The bubbles themselves are separated from the
 * wallpaper by hue and shadow, as in WhatsApp, not by contrast.
 */
export type TennisChatTokens = {
  wallpaper: string;
  ownBubble: string;
  otherBubble: string;
  bubbleText: string;
  ownMeta: string;
  otherMeta: string;
  dayPill: string;
  dayPillText: string;
  composerField: string;
  bubbleShadow: string;
  /** Sender names in a group, one per participant; stable per author. */
  senderNames: readonly string[];
};

export const tennisChatLight: TennisChatTokens = {
  wallpaper: "#EFEAE2",
  ownBubble: "#D9FDD3",
  otherBubble: "#FFFFFF",
  bubbleText: "#111B21",
  ownMeta: "#4F6358",
  otherMeta: "#5E6B72",
  dayPill: "#FFFFFF",
  dayPillText: "#54656F",
  composerField: "#FFFFFF",
  bubbleShadow: "#0B141A",
  senderNames: [
    "#B4235A",
    "#0B6BCB",
    "#9A4A00",
    "#6D28D9",
    "#0F766E",
    "#A1467E",
  ],
};

export const tennisChatDark: TennisChatTokens = {
  wallpaper: "#0B0E08",
  ownBubble: "#1D3B2A",
  otherBubble: "#1F221C",
  bubbleText: "#E9EDEF",
  ownMeta: "#A9BCB0",
  otherMeta: "#A3A9A0",
  dayPill: "#1F221C",
  dayPillText: "#B3B8AF",
  composerField: "#1F221C",
  bubbleShadow: "#000000",
  senderNames: [
    "#F9A8D4",
    "#93C5FD",
    "#FCD34D",
    "#C4B5FD",
    "#5EEAD4",
    "#FDBA74",
  ],
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
  // Fill tracks dark `primary`: white on #8B6DFF was 3.67:1, below AA.
  actionable: { fill: "#6D4FE0", text: "#FFFFFF", border: "#7A5CF0" },
};

const DANGER_TEXT_LIGHT = "#B91C1C";
const DANGER_TEXT_DARK = "#FCA5A5";

type ActiveTennisTheme = {
  scheme: ResolvedAppearance;
  colors: TennisColorTokens;
  brand: TennisBrandTokens;
  chat: TennisChatTokens;
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
      chat: tennisChatDark,
      skillBands: tennisSkillBandsDark,
      semantic: tennisSemanticDark,
      dangerText: DANGER_TEXT_DARK,
    };
  }
  return {
    scheme,
    colors: tennisColorsLight,
    brand: tennisBrandLight,
    chat: tennisChatLight,
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

export const tennisChat: TennisChatTokens = live(() => activeTheme.chat);

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
  control: 11,
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
