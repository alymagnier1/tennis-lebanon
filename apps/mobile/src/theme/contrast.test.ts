import { describe, expect, it } from "vitest";
import { AA_TEXT, contrastRatio, relativeLuminance } from "./contrast";
import {
  getTennisDangerText,
  setActiveTennisScheme,
  tennisColorsDark,
  tennisColorsLight,
  tennisSemanticDark,
  tennisSemanticLight,
  tennisSkillBandsDark,
  tennisSkillBandsLight,
  type ResolvedAppearance,
  type TennisColorTokens,
} from "./tennis-tokens";

/**
 * Locks every token pair the app actually renders text on, in both schemes.
 *
 * Written after an audit found the secondary-button label at 1.05:1 on the
 * dark card, the back chevron at 1.05:1, the text-button label at 1.44:1, and
 * onboarding input text the same colour as the field it was typed into. Each
 * check accumulates into a list and asserts on the list, so one run names
 * every offender instead of stopping at the first.
 */

const SCHEMES = [
  ["light", tennisColorsLight],
  ["dark", tennisColorsDark],
] as const satisfies readonly (readonly [ResolvedAppearance, object])[];

/** Surfaces a foreground token is allowed to sit on, per token. */
const TEXT_ON_SURFACE = {
  primaryDark: ["card", "background", "muted", "secondary"],
  mutedForeground: ["card", "background", "muted", "secondary"],
  linkText: ["card", "background", "muted", "secondary"],
  violetText: ["card", "background", "muted", "secondary"],
  // AppUi/FormUi moved onto these from the dashboard's grey ramp, which has no
  // dark variant and sat at 1.05:1 on the dark card.
  danger: ["card", "background", "muted", "secondary", "dangerSoft"],
} as const satisfies Partial<
  Record<keyof TennisColorTokens, readonly (keyof TennisColorTokens)[]>
>;

/** Label tokens paired with the fill they are named for. */
const LABEL_ON_FILL = [
  ["onPrimary", "primary"],
  ["limeText", "lime"],
  ["onViolet", "violet"],
] as const satisfies readonly (readonly [
  keyof TennisColorTokens,
  keyof TennisColorTokens,
])[];

function failures(
  check: (
    record: (label: string, fg: string, bg: string) => void,
    scheme: ResolvedAppearance,
    colors: TennisColorTokens,
  ) => void,
): string[] {
  const found: string[] = [];
  for (const [scheme, colors] of SCHEMES) {
    check(
      (label, fg, bg) => {
        const ratio = contrastRatio(fg, bg);
        if (ratio < AA_TEXT) {
          found.push(
            `${scheme} ${label}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`,
          );
        }
      },
      scheme,
      colors as TennisColorTokens,
    );
  }
  return found;
}

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("is order-independent and expands shorthand hex", () => {
    expect(contrastRatio("#000", "#FFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#0C382E")).toBeCloseTo(
      contrastRatio("#0C382E", "#FFFFFF"),
      5,
    );
  });

  it("refuses a colour it cannot measure honestly", () => {
    expect(() => contrastRatio("rgba(255,255,255,0.55)", "#000")).toThrow();
  });
});

describe("palette contrast", () => {
  it("keeps foreground tokens readable on every surface they are used on", () => {
    expect(
      failures((record, _scheme, colors) => {
        for (const [fg, surfaces] of Object.entries(TEXT_ON_SURFACE)) {
          for (const surface of surfaces) {
            record(
              `${fg} on ${surface}`,
              colors[fg as keyof TennisColorTokens],
              colors[surface],
            );
          }
        }
      }),
    ).toEqual([]);
  });

  it("keeps each label readable on the fill it is named for", () => {
    expect(
      failures((record, _scheme, colors) => {
        for (const [label, fill] of LABEL_ON_FILL) {
          record(`${label} on ${fill}`, colors[label], colors[fill]);
        }
      }),
    ).toEqual([]);
  });

  it("keeps semantic tone text readable on its own fill", () => {
    const tones = { light: tennisSemanticLight, dark: tennisSemanticDark };
    expect(
      failures((record, scheme) => {
        for (const [tone, token] of Object.entries(tones[scheme])) {
          record(`semantic ${tone}`, token.text, token.fill);
        }
      }),
    ).toEqual([]);
  });

  it("keeps skill-band text readable on its own fill", () => {
    const bands = { light: tennisSkillBandsLight, dark: tennisSkillBandsDark };
    expect(
      failures((record, scheme) => {
        for (const [band, token] of Object.entries(bands[scheme])) {
          record(`skill band ${band}`, token.text, token.fill);
        }
      }),
    ).toEqual([]);
  });

  it("keeps destructive text readable on the surfaces it appears on", () => {
    const found: string[] = [];
    for (const [scheme, colors] of SCHEMES) {
      setActiveTennisScheme(scheme);
      const danger = getTennisDangerText();
      for (const surface of ["card", "background", "dangerSoft"] as const) {
        const ratio = contrastRatio(danger, colors[surface]);
        if (ratio < AA_TEXT) {
          found.push(`${scheme} danger on ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
    }
    setActiveTennisScheme("light");
    expect(found).toEqual([]);
  });
});

describe("hero art tokens", () => {
  it("are not reachable through the scheme-aware palette", () => {
    // The whole point of the tennisHeroArt split. If someone moves one back
    // into tennisColors, the dark-mode failure this test guards returns.
    for (const [, colors] of SCHEMES) {
      expect(Object.keys(colors)).not.toContain("heroOnLight");
      expect(Object.keys(colors)).not.toContain("heroGreen");
    }
  });
});
