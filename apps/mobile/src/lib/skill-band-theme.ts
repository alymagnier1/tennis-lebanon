import { SKILL_BAND_RANK, type SkillBand } from "@tennis-lebanon/domain";
import { tennisColors, tennisSkillBands } from "../theme/tennis-tokens";

export function skillBandProgress(skillBand: string): number {
  const rank = SKILL_BAND_RANK[skillBand as SkillBand];
  if (!rank) return 0.2;
  return rank / 5;
}

export function skillBandColor(skillBand: string): string {
  return (
    tennisSkillBands[skillBand]?.text ??
    tennisSkillBands.intermediate?.text ??
    tennisColors.primary
  );
}

export function skillBandFill(skillBand: string): string {
  return (
    tennisSkillBands[skillBand]?.fill ??
    tennisSkillBands.intermediate?.fill ??
    "#C8E63B"
  );
}
