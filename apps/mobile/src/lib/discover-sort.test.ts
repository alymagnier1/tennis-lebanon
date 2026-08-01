import { describe, expect, it } from "vitest";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { sortCompatiblePlayers } from "./discover-sort";

function player(
  overrides: Partial<CompatiblePlayerCard>,
): CompatiblePlayerCard {
  return {
    user_id: "default",
    display_name: "Player",
    avatar_path: null,
    skill_band: "intermediate",
    play_intent: "either",
    prefers_singles: true,
    prefers_doubles: false,
    zones: [],
    provisional_rating_label: "Provisional",
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
    ...overrides,
  };
}

describe("sortCompatiblePlayers", () => {
  it("keeps server order for recommended sort", () => {
    const players = [
      player({ user_id: "a", level_fit: true }),
      player({ user_id: "b", level_fit: false }),
    ];

    expect(
      sortCompatiblePlayers(players, "recommended").map((p) => p.user_id),
    ).toEqual(["a", "b"]);
  });

  it("prioritizes level fit when sorting by level", () => {
    const players = [
      player({ user_id: "a", level_fit: false }),
      player({ user_id: "b", level_fit: true }),
    ];

    expect(
      sortCompatiblePlayers(players, "level").map((p) => p.user_id),
    ).toEqual(["b", "a"]);
  });
});
