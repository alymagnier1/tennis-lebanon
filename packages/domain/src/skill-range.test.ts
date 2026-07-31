import { describe, expect, it } from "vitest";
import {
  formatSkillBandSelection,
  ORDERED_SKILL_BANDS,
  skillBandsInRange,
  skillRangeFromSelection,
  toggleSkillBandSelection,
} from "./skill-range";

describe("skill range selection", () => {
  it("returns contiguous bands between min and max", () => {
    expect(skillBandsInRange("improving", "intermediate")).toEqual([
      "improving",
      "intermediate",
    ]);
  });

  it("toggles bands without clearing the last selection", () => {
    expect(toggleSkillBandSelection(["intermediate"], "intermediate")).toEqual([
      "intermediate",
    ]);
    expect(toggleSkillBandSelection(["intermediate"], "advanced")).toEqual([
      "intermediate",
      "advanced",
    ]);
  });

  it("derives min and max from selected bands", () => {
    expect(skillRangeFromSelection(["beginner", "advanced"])).toEqual({
      minSkill: "beginner",
      maxSkill: "advanced",
    });
  });

  it("formats contiguous ranges with an en dash", () => {
    expect(
      formatSkillBandSelection(["improving", "intermediate"], (band) => band),
    ).toBe("improving – intermediate");
  });

  it("formats all levels as a full span", () => {
    expect(formatSkillBandSelection(ORDERED_SKILL_BANDS, (band) => band)).toBe(
      "beginner – competitive",
    );
  });
});
