import { SKILL_BAND_RANK, type SkillBand } from "@tennis-lebanon/domain";

export const SKILL_BAND_COLORS: Record<SkillBand, string> = {
  beginner: "#16a34a",
  improving: "#2563eb",
  intermediate: "#6366f1",
  advanced: "#9333ea",
  competitive: "#dc2626",
};

export function skillBandProgress(skillBand: string): number {
  const rank = SKILL_BAND_RANK[skillBand as SkillBand];
  if (!rank) return 0.2;
  return rank / 5;
}

export function skillBandColor(skillBand: string): string {
  return (
    SKILL_BAND_COLORS[skillBand as SkillBand] ?? SKILL_BAND_COLORS.intermediate
  );
}
