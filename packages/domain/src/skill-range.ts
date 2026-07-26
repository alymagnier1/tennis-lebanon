import type { SkillBand } from "./onboarding";
import { skillBandRank } from "./discovery";

export const ORDERED_SKILL_BANDS: SkillBand[] = [
  "beginner",
  "improving",
  "intermediate",
  "advanced",
  "competitive",
];

export function skillBandsInRange(
  minSkill: SkillBand,
  maxSkill: SkillBand,
): SkillBand[] {
  const minRank = skillBandRank(minSkill);
  const maxRank = skillBandRank(maxSkill);
  return ORDERED_SKILL_BANDS.filter((band) => {
    const rank = skillBandRank(band);
    return rank >= minRank && rank <= maxRank;
  });
}

export function skillRangeFromSelection(selected: SkillBand[]): {
  minSkill: SkillBand;
  maxSkill: SkillBand;
} {
  if (selected.length === 0) {
    throw new Error("At least one skill band must be selected");
  }

  const sorted = [...selected].sort(
    (left, right) => skillBandRank(left) - skillBandRank(right),
  );

  return {
    minSkill: sorted[0]!,
    maxSkill: sorted[sorted.length - 1]!,
  };
}

export function toggleSkillBandSelection(
  selected: SkillBand[],
  band: SkillBand,
): SkillBand[] {
  if (selected.includes(band)) {
    if (selected.length === 1) {
      return selected;
    }
    return selected.filter((value) => value !== band);
  }

  return [...selected, band].sort(
    (left, right) => skillBandRank(left) - skillBandRank(right),
  );
}

export function isSkillBandSelected(
  band: SkillBand,
  selected: SkillBand[],
): boolean {
  return selected.includes(band);
}

export function formatSkillBandSelection(
  selected: SkillBand[],
  labelFor: (band: SkillBand) => string,
): string {
  const sorted = [...selected].sort(
    (left, right) => skillBandRank(left) - skillBandRank(right),
  );

  if (sorted.length === 0) {
    return "";
  }

  if (sorted.length === ORDERED_SKILL_BANDS.length) {
    return labelFor("beginner") + " – " + labelFor("competitive");
  }

  const contiguous = sorted.every((band, index) => {
    if (index === 0) return true;
    return (
      skillBandRank(band) - skillBandRank(sorted[index - 1]!) === 1
    );
  });

  if (contiguous && sorted.length > 1) {
    return `${labelFor(sorted[0]!)} – ${labelFor(sorted[sorted.length - 1]!)}`;
  }

  return sorted.map(labelFor).join(", ");
}
