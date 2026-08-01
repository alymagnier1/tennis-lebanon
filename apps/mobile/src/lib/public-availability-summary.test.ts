import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import {
  formatAvailabilityDayPartsLabel,
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
