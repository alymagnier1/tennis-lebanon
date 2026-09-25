import type { TFunction } from "i18next";
import { ORDERED_SKILL_BANDS } from "@tennis-lebanon/domain";

/** Same band blurbs as onboarding — one line each for the create/profile help sheet. */
export function skillBandHelpBody(t: TFunction): string {
  return ORDERED_SKILL_BANDS.map(
    (band) =>
      `${t(`skillBands.${band}`)} — ${t(`onboarding.tennis.bands.${band}`)}`,
  ).join("\n");
}
