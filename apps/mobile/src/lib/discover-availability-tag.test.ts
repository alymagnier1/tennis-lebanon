import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import {
  discoverPlayerAvailabilityLine,
  discoverPlayerAvailabilityTags,
} from "./discover-availability-tag";
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

describe("discoverPlayerAvailabilityTags", () => {
  const t = vi.fn((key: string) => {
    const [, style, weekday] = key.split(".");
    const short = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const compact = ["Sun", "M", "T", "W", "Th", "F", "Sat"];
    if (style === "weekdaysShort") return short[Number(weekday)];
    if (style === "weekdaysCompact") return compact[Number(weekday)];
    return key;
  }) as unknown as TFunction;

  it("spells out each shared near-term overlap day", () => {
    // 2026-08-04 is a Tuesday in Asia/Beirut.
    expect(discoverPlayerAvailabilityTags(player(), true, t)).toEqual(["Tue"]);
  });

  it("shows the player's near-term days when the overlap chip is off", () => {
    // 2026-08-07 is a Friday in Asia/Beirut.
    expect(discoverPlayerAvailabilityTags(player(), false, t)).toEqual(["Fri"]);
  });

  it("falls back to usual weekdays, one label per day", () => {
    const distant = player({
      near_term_overlap_slots: [],
      availability_weekdays: [6, 0],
      availability_day_parts: ["evening"],
    });

    expect(discoverPlayerAvailabilityTags(distant, true, t)).toEqual([
      "Sun",
      "Sat",
    ]);
  });

  it("compacts the labels when more than three days would not fit", () => {
    const busy = player({
      near_term_overlap_slots: [],
      availability_weekdays: [1, 2, 4, 5],
      availability_day_parts: ["evening"],
    });

    expect(discoverPlayerAvailabilityTags(busy, true, t)).toEqual([
      "M",
      "T",
      "Th",
      "F",
    ]);
  });

  it("shows the days alone and keeps the full sentence for screen readers", () => {
    const tLine = ((key: string, options?: { days?: string }) =>
      key === "discover.availableOn"
        ? `Available ${options?.days}`
        : (t as unknown as (k: string) => string)(key)) as unknown as TFunction;

    expect(
      discoverPlayerAvailabilityLine(
        player({
          near_term_overlap_slots: [],
          availability_weekdays: [5, 4],
          availability_day_parts: ["evening"],
        }),
        true,
        tLine,
      ),
    ).toEqual({
      text: "Thu · Fri",
      accessibilityLabel: "Available Thu · Fri",
    });
    expect(
      discoverPlayerAvailabilityLine(
        player({
          near_term_slots: [],
          near_term_overlap_slots: [],
          availability_weekdays: [],
          availability_day_parts: [],
        }),
        true,
        tLine,
      ),
    ).toBeNull();
  });

  it("shows nothing when there is neither an overlap nor a pattern", () => {
    const empty = player({
      near_term_slots: [],
      near_term_overlap_slots: [],
      availability_weekdays: [],
      availability_day_parts: [],
    });

    expect(discoverPlayerAvailabilityTags(empty, true, t)).toEqual([]);
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
