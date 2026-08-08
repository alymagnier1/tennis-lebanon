import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { discoverPlayerAvailabilityTag } from "./discover-availability-tag";
import { formatNearTermAvailabilitySlots } from "./near-term-availability";

function player(
  overrides: Partial<CompatiblePlayerCard> = {},
): CompatiblePlayerCard {
  return {
    user_id: "player-1",
    display_name: "Player",
    avatar_path: null,
    skill_band: "intermediate",
    play_intent: "either",
    prefers_singles: true,
    prefers_doubles: false,
    zones: [],
    provisional_rating_label: "provisional",
    display_rating: null,
    completed_match_count: 0,
    level_fit: true,
    zone_overlap: true,
    availability_overlap: true,
    intent_fit: true,
    format_fit: true,
    overlap_starts_at: null,
    overlap_ends_at: null,
    bio: null,
    availability_weekdays: [],
    availability_day_parts: [],
    near_term_slots: [
      {
        starts_at: "2026-08-07T14:00:00.000Z",
        ends_at: "2026-08-07T17:00:00.000Z",
      },
    ],
    near_term_overlap_slots: [
      {
        starts_at: "2026-08-04T14:00:00.000Z",
        ends_at: "2026-08-04T17:00:00.000Z",
      },
    ],
    favorite_clubs: [],
    ...overrides,
  };
}

describe("discoverPlayerAvailabilityTag", () => {
  const now = new Date("2026-08-04T10:00:00.000Z");
  const t = vi.fn((key: string, options?: Record<string, string>) => {
    if (key === "discover.today") return "Today";
    if (key === "discover.tomorrow") return "Tomorrow";
    if (key === "availability.weekdaysShort.5") return "Fri";
    if (key === "availability.weekdaysShort.6") return "Sat";
    if (key === "availability.blocks.evening") return "Evening";
    if (key === "discover.usualAvailability") {
      return `Usually ${options?.schedule}`;
    }
    return key;
  }) as unknown as TFunction;

  it("shows shared near-term overlap when the availability chip is on", () => {
    expect(discoverPlayerAvailabilityTag(player(), true, t, now)).toBe(
      "Today · Evening",
    );
  });

  it("shows the player's near-term schedule when the chip is off", () => {
    expect(discoverPlayerAvailabilityTag(player(), false, t, now)).toBe(
      "Fri · Evening",
    );
  });

  // Discovery matches over the full horizon, so a player can reach the card
  // with no shared slot inside the three-day chip window. The card must still
  // say something rather than look like the player never plays.
  it("falls back to the usual pattern when nothing is shared in three days", () => {
    const distant = player({
      near_term_overlap_slots: [],
      availability_weekdays: [6],
      availability_day_parts: ["evening"],
    });

    expect(discoverPlayerAvailabilityTag(distant, true, t, now)).toBe(
      "Usually Sat · Evening",
    );
  });

  it("shows nothing when there is neither an overlap nor a pattern", () => {
    const empty = player({
      near_term_slots: [],
      near_term_overlap_slots: [],
      availability_weekdays: [],
      availability_day_parts: [],
    });

    expect(discoverPlayerAvailabilityTag(empty, true, t, now)).toBeNull();
  });
});

describe("formatNearTermAvailabilitySlots", () => {
  const now = new Date("2026-08-04T10:00:00.000Z");
  const t = vi.fn((key: string) => {
    if (key === "discover.today") return "Today";
    if (key === "discover.tomorrow") return "Tomorrow";
    if (key === "availability.weekdaysShort.6") return "Sat";
    if (key === "availability.blocks.evening") return "Evening";
    if (key === "availability.blocks.morning") return "Morning";
    return key;
  }) as unknown as TFunction;

  it("joins multiple days in the near-term window", () => {
    expect(
      formatNearTermAvailabilitySlots(
        [
          {
            starts_at: "2026-08-04T14:00:00.000Z",
            ends_at: "2026-08-04T17:00:00.000Z",
          },
          {
            starts_at: "2026-08-08T06:00:00.000Z",
            ends_at: "2026-08-08T08:00:00.000Z",
          },
        ],
        t,
        now,
      ),
    ).toBe("Today · Evening, Sat · Morning");
  });
});
