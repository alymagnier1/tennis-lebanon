import { describe, expect, it } from "vitest";
import type { OpenMatchCard } from "@tennis-lebanon/api";
import { pickHomeOpenMatches } from "./home-open-matches";

function match(
  overrides: Partial<OpenMatchCard> & Pick<OpenMatchCard, "match_id">,
): OpenMatchCard {
  return {
    format: "singles",
    intent: "either",
    visibility: "public",
    status: "open",
    requires_creator_approval: false,
    min_skill: "beginner",
    max_skill: "advanced",
    zones: [],
    preferred_clubs: [],
    proposed_times: [],
    participant_count: 1,
    capacity: 2,
    creator_display_name: "Host",
    creator_avatar_path: null,
    notes: null,
    level_fit: false,
    zone_overlap: false,
    availability_overlap: false,
    created_at: "2026-08-01T00:00:00.000Z",
    court_secured: false,
    court_club_name: null,
    ...overrides,
  };
}

describe("pickHomeOpenMatches", () => {
  it("keeps matches that overlap availability, area, or preferred club", () => {
    const rows = [
      match({ match_id: "time", availability_overlap: true }),
      match({ match_id: "area", zone_overlap: true }),
      match({
        match_id: "club",
        preferred_clubs: [
          { club_id: "c1", name: "Hoops", booking_mode: "whatsapp" },
        ],
      }),
      match({ match_id: "none" }),
    ];

    expect(
      pickHomeOpenMatches(rows, ["c1"]).map((row) => row.match_id),
    ).toEqual(["time", "club"]);
  });

  it("ranks overlapping time above club and area, and returns two", () => {
    const rows = [
      match({
        match_id: "club",
        created_at: "2026-08-03T00:00:00.000Z",
        preferred_clubs: [
          { club_id: "c1", name: "Hoops", booking_mode: "whatsapp" },
        ],
      }),
      match({
        match_id: "area",
        created_at: "2026-08-04T00:00:00.000Z",
        zone_overlap: true,
      }),
      match({
        match_id: "time",
        created_at: "2026-08-01T00:00:00.000Z",
        availability_overlap: true,
      }),
    ];

    expect(
      pickHomeOpenMatches(rows, ["c1"]).map((row) => row.match_id),
    ).toEqual(["time", "club"]);
  });

  it("drops matches with no time, area, or club overlap", () => {
    expect(
      pickHomeOpenMatches(
        [match({ match_id: "other-club", preferred_clubs: [] })],
        ["c1"],
      ),
    ).toEqual([]);
  });
});
