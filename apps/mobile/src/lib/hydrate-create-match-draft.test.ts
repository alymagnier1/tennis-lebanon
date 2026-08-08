import { describe, expect, it } from "vitest";
import {
  buildCreateMatchDraftFromHostDefaults,
  matchHostDefaultsRowFromProfile,
  resolveMatchHostDefaults,
} from "@tennis-lebanon/domain";
import {
  createMatchDraftHasInviteTarget,
  hydrateCreateMatchDraftFromProfile,
} from "./hydrate-create-match-draft";
import {
  getCreateMatchDraft,
  resetCreateMatchDraft,
  updateCreateMatchDraft,
} from "./create-match-draft";

const sampleProfile = {
  skill_band: "intermediate",
  play_intent: "social",
  prefers_singles: true,
  prefers_doubles: false,
  internal_rating: 1200,
  rated_match_count: 0,
  bio: null,
  display_name: "Test",
  languages: ["en"],
  default_match_visibility: "public",
  default_requires_creator_approval: false,
  default_min_skill: null,
  default_max_skill: null,
  default_match_format: null,
  match_defaults_set_at: null,
  match_host_defaults_available: true,
};

describe("createMatchDraftHasInviteTarget", () => {
  it("is false when only a stale target id remains", () => {
    updateCreateMatchDraft({
      targetPlayerId: "11111111-1111-1111-1111-111111111111",
      targetPlayerName: "Player D",
    });
    expect(createMatchDraftHasInviteTarget()).toBe(false);
  });

  it("is true for an explicit invite-for-player flow", () => {
    updateCreateMatchDraft({
      inviteForPlayer: true,
      targetPlayerId: "11111111-1111-1111-1111-111111111111",
      targetPlayerName: "Player D",
    });
    expect(createMatchDraftHasInviteTarget()).toBe(true);
  });
});

describe("hydrateCreateMatchDraftFromProfile", () => {
  it("fills draft fields from resolved host defaults", () => {
    resetCreateMatchDraft();
    hydrateCreateMatchDraftFromProfile(sampleProfile, ["zone-1"]);

    const draft = getCreateMatchDraft();
    const resolved = resolveMatchHostDefaults(
      matchHostDefaultsRowFromProfile(sampleProfile),
    );
    const expected = buildCreateMatchDraftFromHostDefaults(resolved, ["zone-1"]);

    expect(draft.format).toBe(expected.format);
    expect(draft.intent).toBe(expected.intent);
    expect(draft.visibility).toBe(expected.visibility);
    expect(draft.zoneIds).toEqual(["zone-1"]);
    expect(draft.timingMode).toBe("fixed");
  });
});
