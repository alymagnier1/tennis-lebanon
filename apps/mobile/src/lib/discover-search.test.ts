import { describe, expect, it } from "vitest";
import type { CompatiblePlayerCard, OpenMatchCard } from "@tennis-lebanon/api";
import {
  filterDiscoverMatchesBySearch,
  filterDiscoverPlayersBySearch,
} from "./discover-search";

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
    level_fit: true,
    zone_overlap: true,
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
    zones: [{ id: "1", slug: "beirut", name_i18n: { en: "Pilotirut" } }],
    preferred_clubs: [{ club_id: "c1", name: "Hoops", booking_mode: "external_link" }],
    proposed_times: [],
    participant_count: 1,
    capacity: 2,
    creator_display_name: "Player D",
    creator_avatar_path: null,
    notes: null,
    level_fit: true,
    zone_overlap: true,
    availability_overlap: false,
    created_at: "2026-08-01T00:00:00.000Z",
    court_secured: false,
    court_club_name: null,
    ...overrides,
  };
}

describe("filterDiscoverPlayersBySearch", () => {
  it("filters by display name", () => {
    const rows = [
      player({ user_id: "1", display_name: "Rami Haddad" }),
      player({ user_id: "2", display_name: "Player D" }),
    ];
    expect(
      filterDiscoverPlayersBySearch(rows, "rami").map((p) => p.user_id),
    ).toEqual(["1"]);
  });

  it("returns all rows when the query is blank", () => {
    const rows = [player({ user_id: "1", display_name: "A" })];
    expect(filterDiscoverPlayersBySearch(rows, "  ")).toEqual(rows);
  });
});

describe("filterDiscoverMatchesBySearch", () => {
  it("matches host, club, or area text", () => {
    const rows = [
      match({ match_id: "a" }),
      match({
        match_id: "b",
        creator_display_name: "Other",
        preferred_clubs: [],
        zones: [{ id: "2", slug: "metn", name_i18n: { en: "Metn" } }],
      }),
    ];
    expect(
      filterDiscoverMatchesBySearch(rows, "hoops", "en").map((m) => m.match_id),
    ).toEqual(["a"]);
    expect(
      filterDiscoverMatchesBySearch(rows, "metn", "en").map((m) => m.match_id),
    ).toEqual(["b"]);
  });
});
