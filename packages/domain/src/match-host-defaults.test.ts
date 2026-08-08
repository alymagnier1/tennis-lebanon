import { describe, expect, it } from "vitest";
import {
  buildCreateMatchDraftFromHostDefaults,
  hasConfiguredMatchDefaults,
  matchHostDefaultsRowFromProfile,
  preferredFormatForPlayer,
  resolveMatchHostDefaults,
  skillBandsForPlayer,
  updateMatchHostDefaultsSchema,
} from "./match-host-defaults";

const baseRow = {
  skill_band: "intermediate" as const,
  play_intent: "social" as const,
  prefers_singles: true,
  prefers_doubles: false,
  default_match_visibility: "public" as const,
  default_requires_creator_approval: false,
  default_min_skill: null,
  default_max_skill: null,
  default_match_format: null,
  match_defaults_set_at: null,
};

describe("resolveMatchHostDefaults", () => {
  it("derives level range from skill band when min/max are null", () => {
    const resolved = resolveMatchHostDefaults(matchHostDefaultsRowFromProfile(baseRow));
    expect(resolved.minSkill).toBe("improving");
    expect(resolved.maxSkill).toBe("advanced");
    expect(resolved.selectedSkillBands).toEqual(
      skillBandsForPlayer("intermediate"),
    );
  });

  it("uses explicit min/max when set", () => {
    const resolved = resolveMatchHostDefaults(
      matchHostDefaultsRowFromProfile({
        ...baseRow,
        default_min_skill: "beginner",
        default_max_skill: "competitive",
      }),
    );
    expect(resolved.minSkill).toBe("beginner");
    expect(resolved.maxSkill).toBe("competitive");
  });

  it("clears approval when visibility is not public", () => {
    const resolved = resolveMatchHostDefaults(
      matchHostDefaultsRowFromProfile({
        ...baseRow,
        default_match_visibility: "invite_only",
        default_requires_creator_approval: true,
      }),
    );
    expect(resolved.visibility).toBe("invite_only");
    expect(resolved.requiresCreatorApproval).toBe(false);
  });

  it("uses default_match_format when both formats preferred", () => {
    const resolved = resolveMatchHostDefaults(
      matchHostDefaultsRowFromProfile({
        ...baseRow,
        prefers_singles: true,
        prefers_doubles: true,
        default_match_format: "doubles",
      }),
    );
    expect(resolved.format).toBe("doubles");
  });
});

describe("preferredFormatForPlayer", () => {
  it("defaults to singles when both formats are enabled", () => {
    expect(
      preferredFormatForPlayer({ prefers_singles: true, prefers_doubles: true }),
    ).toBe("singles");
  });
});

describe("buildCreateMatchDraftFromHostDefaults", () => {
  it("includes zone ids in the draft patch", () => {
    const resolved = resolveMatchHostDefaults(matchHostDefaultsRowFromProfile(baseRow));
    const draft = buildCreateMatchDraftFromHostDefaults(resolved, ["zone-a"]);
    expect(draft.zoneIds).toEqual(["zone-a"]);
    expect(draft.format).toBe("singles");
    expect(draft.timingMode).toBe("fixed");
  });
});

describe("hasConfiguredMatchDefaults", () => {
  it("returns false when timestamp is null", () => {
    expect(hasConfiguredMatchDefaults(null)).toBe(false);
  });

  it("returns true when timestamp is set", () => {
    expect(hasConfiguredMatchDefaults("2026-01-01T00:00:00Z")).toBe(true);
  });
});

describe("updateMatchHostDefaultsSchema", () => {
  it("requires default format when both singles and doubles are on", () => {
    const result = updateMatchHostDefaultsSchema.safeParse({
      playIntent: "either",
      prefersSingles: true,
      prefersDoubles: true,
      listOnDiscover: true,
      defaultRequiresCreatorApproval: false,
      defaultMinSkill: "intermediate",
      defaultMaxSkill: "intermediate",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a single preferred format without an explicit default", () => {
    const result = updateMatchHostDefaultsSchema.safeParse({
      playIntent: "social",
      prefersSingles: true,
      prefersDoubles: false,
      listOnDiscover: true,
      defaultRequiresCreatorApproval: false,
      defaultMinSkill: "improving",
      defaultMaxSkill: "advanced",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when neither singles nor doubles is selected", () => {
    const result = updateMatchHostDefaultsSchema.safeParse({
      playIntent: "either",
      prefersSingles: false,
      prefersDoubles: false,
      listOnDiscover: true,
      defaultRequiresCreatorApproval: false,
      defaultMinSkill: "intermediate",
      defaultMaxSkill: "intermediate",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a min skill above the max", () => {
    const result = updateMatchHostDefaultsSchema.safeParse({
      playIntent: "either",
      prefersSingles: true,
      prefersDoubles: false,
      listOnDiscover: true,
      defaultRequiresCreatorApproval: false,
      defaultMinSkill: "advanced",
      defaultMaxSkill: "beginner",
    });
    expect(result.success).toBe(false);
  });
});
