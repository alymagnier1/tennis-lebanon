import { describe, expect, it } from "vitest";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import {
  preferredFormatForPlayer,
  skillBandsForPlayer,
} from "@tennis-lebanon/domain";
import {
  overlapProposedTimeForPlayer,
  prefillCreateMatchDraftForPlayer,
  zoneIdsFromPlayerZones,
} from "./prefill-create-match-for-player";

function samplePlayer(
  overrides: Partial<CompatiblePlayerCard> = {},
): CompatiblePlayerCard {
  return {
    user_id: "11111111-1111-1111-1111-111111111111",
    display_name: "Rami",
    avatar_path: null,
    skill_band: "intermediate",
    play_intent: "social",
    prefers_singles: true,
    prefers_doubles: false,
    zones: [{ id: "22222222-2222-2222-2222-222222222222", slug: "beirut" }],
    provisional_rating_label: "provisional",
    display_rating: null,
    completed_match_count: 3,
    level_fit: true,
    zone_overlap: true,
    availability_overlap: true,
    intent_fit: true,
    format_fit: true,
    overlap_starts_at: "2026-08-02T15:00:00.000Z",
    overlap_ends_at: "2026-08-02T16:30:00.000Z",
    bio: null,
    availability_weekdays: [5],
    availability_day_parts: ["evening"],
    near_term_slots: [],
    near_term_overlap_slots: [
      {
        starts_at: "2026-08-02T15:00:00.000Z",
        ends_at: "2026-08-02T16:30:00.000Z",
      },
    ],
    favorite_clubs: [],
    ...overrides,
  };
}

describe("preferredFormatForPlayer", () => {
  it("prefers singles when only singles is selected", () => {
    expect(
      preferredFormatForPlayer({
        prefers_singles: true,
        prefers_doubles: false,
      }),
    ).toBe("singles");
  });

  it("defaults to singles when both formats are selected", () => {
    expect(
      preferredFormatForPlayer({
        prefers_singles: true,
        prefers_doubles: true,
      }),
    ).toBe("singles");
  });
});

describe("skillBandsForPlayer", () => {
  it("includes the player band plus one step on each side", () => {
    expect(skillBandsForPlayer("intermediate")).toEqual([
      "improving",
      "intermediate",
      "advanced",
    ]);
  });
});

describe("zoneIdsFromPlayerZones", () => {
  it("extracts zone ids from discover card zones", () => {
    expect(
      zoneIdsFromPlayerZones([
        { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
        { slug: "missing-id" },
      ]),
    ).toEqual(["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]);
  });
});

describe("overlapProposedTimeForPlayer", () => {
  it("uses overlap timestamps when present", () => {
    expect(overlapProposedTimeForPlayer(samplePlayer())).toEqual({
      startsAt: "2026-08-02T15:00:00.000Z",
      endsAt: "2026-08-02T16:30:00.000Z",
    });
  });
});

describe("prefillCreateMatchDraftForPlayer", () => {
  it("seeds invite-only create draft context for the selected player", () => {
    const draft = prefillCreateMatchDraftForPlayer(samplePlayer());

    expect(draft).toMatchObject({
      format: "singles",
      intent: "social",
      visibility: "invite_only",
      requiresCreatorApproval: false,
      zoneIds: ["22222222-2222-2222-2222-222222222222"],
      targetPlayerId: "11111111-1111-1111-1111-111111111111",
      targetPlayerName: "Rami",
      timingMode: "fixed",
      proposedTimes: [
        {
          startsAt: "2026-08-02T15:00:00.000Z",
          endsAt: "2026-08-02T16:30:00.000Z",
        },
      ],
    });
    expect(draft.selectedSkillBands).toEqual([
      "improving",
      "intermediate",
      "advanced",
    ]);
  });
});
