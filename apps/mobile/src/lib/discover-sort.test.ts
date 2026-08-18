import { describe, expect, it } from "vitest";
import type { CompatiblePlayerCard, OpenMatchCard } from "@tennis-lebanon/api";
import { sortDiscoverMatches, sortDiscoverPlayers } from "./discover-sort";

function player(
  overrides: Partial<CompatiblePlayerCard> &
    Pick<CompatiblePlayerCard, "user_id" | "display_name">,
): CompatiblePlayerCard {
  return {
    avatar_path: null,
    skill_band: "intermediate",
    play_intent: "either",
    prefers_singles: true,
    prefers_doubles: true,
    zones: [],
    provisional_rating_label: "provisional",
    display_rating: null,
    completed_match_count: 0,
    level_fit: false,
    zone_overlap: false,
    availability_overlap: false,
    intent_fit: true,
    format_fit: true,
    overlap_starts_at: null,
    overlap_ends_at: null,
    bio: null,
    availability_weekdays: [],
    availability_day_parts: [],
    near_term_slots: [],
    near_term_overlap_slots: [],
    favorite_clubs: [],
    ...overrides,
  };
}

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

describe("sortDiscoverPlayers", () => {
  it("keeps recommended order", () => {
    const rows = [
      player({ user_id: "a", display_name: "A", availability_overlap: false }),
      player({ user_id: "b", display_name: "B", availability_overlap: true }),
    ];
    expect(
      sortDiscoverPlayers(rows, "recommended").map((p) => p.user_id),
    ).toEqual(["a", "b"]);
  });

  it("sorts by area overlap first", () => {
    const rows = [
      player({ user_id: "a", display_name: "A", zone_overlap: false }),
      player({ user_id: "b", display_name: "B", zone_overlap: true }),
    ];
    expect(sortDiscoverPlayers(rows, "area").map((p) => p.user_id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("sorts by availability then soonest overlap", () => {
    const rows = [
      player({
        user_id: "late",
        display_name: "Late",
        availability_overlap: true,
        overlap_starts_at: "2026-08-20T18:00:00.000Z",
      }),
      player({
        user_id: "soon",
        display_name: "Soon",
        availability_overlap: true,
        overlap_starts_at: "2026-08-16T10:00:00.000Z",
      }),
      player({
        user_id: "none",
        display_name: "None",
        availability_overlap: false,
      }),
    ];
    expect(
      sortDiscoverPlayers(rows, "availability").map((p) => p.user_id),
    ).toEqual(["soon", "late", "none"]);
  });

  it("sorts by level fit then skill distance to the viewer", () => {
    const rows = [
      player({
        user_id: "far",
        display_name: "Far",
        level_fit: true,
        skill_band: "competitive",
      }),
      player({
        user_id: "near",
        display_name: "Near",
        level_fit: true,
        skill_band: "intermediate",
      }),
      player({
        user_id: "miss",
        display_name: "Miss",
        level_fit: false,
        skill_band: "beginner",
      }),
    ];
    expect(
      sortDiscoverPlayers(rows, "level", "intermediate").map((p) => p.user_id),
    ).toEqual(["near", "far", "miss"]);
  });
});

describe("sortDiscoverMatches", () => {
  it("sorts open matches by the selected fit flag", () => {
    const rows = [
      match({ match_id: "a", zone_overlap: false }),
      match({ match_id: "b", zone_overlap: true }),
    ];
    expect(sortDiscoverMatches(rows, "area").map((m) => m.match_id)).toEqual([
      "b",
      "a",
    ]);
  });
});
