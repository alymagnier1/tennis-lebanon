import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import {
  formatAvailabilityDayPartsLabel,
  formatDiscoverPlayerAvailabilityLabel,
  sortAvailabilityDayParts,
  weekdayShortLabels,
} from "./public-availability-summary";

describe("public availability summary labels", () => {
  const t = vi.fn((key: string, options?: Record<string, string>) => {
    if (key === "availability.blocks.morning") return "Morning";
    if (key === "availability.blocks.afternoon") return "Afternoon";
    if (key === "availability.blocks.evening") return "Evening";
    if (key === "playerProfile.availabilityPartsTwo") {
      return `${options?.first} and ${options?.second}`;
    }
    if (key.startsWith("availability.weekdaysShort.")) {
      return key.split(".").pop() ?? "";
    }
    return key;
  }) as unknown as TFunction;

  it("sorts day parts in display order", () => {
    expect(sortAvailabilityDayParts(["evening", "morning"])).toEqual([
      "morning",
      "evening",
    ]);
  });

  it("formats one or two day parts", () => {
    expect(formatAvailabilityDayPartsLabel(["morning"], t)).toBe("Morning");
    expect(formatAvailabilityDayPartsLabel(["evening", "morning"], t)).toBe(
      "Morning and Evening",
    );
  });

  it("maps weekday numbers to short labels", () => {
    expect(weekdayShortLabels([4, 1], t)).toEqual(["1", "4"]);
  });
});

describe("formatDiscoverPlayerAvailabilityLabel", () => {
  const t = vi.fn((key: string, options?: Record<string, string | number>) => {
    if (key === "availability.blocks.morning") return "Morning";
    if (key === "availability.blocks.evening") return "Evening";
    if (key === "availability.blocks.allDay") return "All day";
    if (key === "playerProfile.availabilityPartsTwo") {
      return `${options?.first} and ${options?.second}`;
    }
    if (key.startsWith("availability.weekdaysShort.")) {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return names[Number(key.split(".").pop())] ?? "";
    }
    if (key === "discover.playerAvailabilityManyDays") {
      return `${options?.blocks} · ${options?.count} days`;
    }
    return key;
  }) as unknown as TFunction;

  it("formats a single weekday and block", () => {
    expect(formatDiscoverPlayerAvailabilityLabel([5], ["evening"], t)).toBe(
      "Fri · Evening",
    );
  });

  it("lists up to three weekdays against their blocks", () => {
    expect(
      formatDiscoverPlayerAvailabilityLabel([6, 5], ["evening", "morning"], t),
    ).toBe("Fri, Sat · Morning and Evening");
  });

  it("collapses all three blocks to a single all-day label", () => {
    expect(
      formatDiscoverPlayerAvailabilityLabel(
        [5, 6, 0],
        ["morning", "afternoon", "evening"],
        t,
      ),
    ).toBe("Sun, Fri, Sat · All day");
  });

  it("collapses to a day count past three weekdays", () => {
    expect(
      formatDiscoverPlayerAvailabilityLabel([1, 2, 3, 4], ["evening"], t),
    ).toBe("Evening · 4 days");
  });

  it("falls back to blocks only when weekdays are missing", () => {
    expect(formatDiscoverPlayerAvailabilityLabel([], ["evening"], t)).toBe(
      "Evening",
    );
  });

  it("returns null when the player has no recurring pattern", () => {
    expect(formatDiscoverPlayerAvailabilityLabel([5], [], t)).toBeNull();
  });
});
