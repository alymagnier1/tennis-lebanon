import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import {
  availabilityDayPartFromLocalTime,
  availabilityDayPartsFromOverlap,
  formatOverlapAvailabilityLabel,
} from "./player-availability-label";

describe("availabilityDayPartFromLocalTime", () => {
  it("maps hours to morning, afternoon, and evening blocks", () => {
    expect(availabilityDayPartFromLocalTime("08:30")).toBe("morning");
    expect(availabilityDayPartFromLocalTime("14:00")).toBe("afternoon");
    expect(availabilityDayPartFromLocalTime("19:15")).toBe("evening");
  });
});

describe("availabilityDayPartsFromOverlap", () => {
  it("returns one part when overlap stays in the same block", () => {
    expect(
      availabilityDayPartsFromOverlap(
        "2026-08-01T05:00:00.000Z",
        "2026-08-01T06:30:00.000Z",
      ),
    ).toEqual(["morning"]);
  });
});

describe("formatOverlapAvailabilityLabel", () => {
  const t = vi.fn((key: string, options?: Record<string, string>) => {
    if (key === "availability.weekdaysShort.5") return "Fri";
    if (key === "availability.blocks.evening") return "Evening";
    if (key === "availability.blocks.afternoon") return "Afternoon";
    if (key === "playerProfile.availabilityPartsTwo") {
      return `${options?.first} & ${options?.second}`;
    }
    if (key === "discover.overlapAvailability") {
      return `${options?.weekday} · ${options?.blocks}`;
    }
    return key;
  }) as unknown as TFunction;

  it("formats a single-block overlap with weekday", () => {
    expect(
      formatOverlapAvailabilityLabel(
        "2026-08-07T15:00:00.000Z",
        "2026-08-07T18:00:00.000Z",
        t,
      ),
    ).toBe("Fri · Evening");
  });

  it("formats a two-block overlap on the same day", () => {
    const twoBlockT = vi.fn((key: string, options?: Record<string, string>) => {
      if (key === "availability.weekdaysShort.2") return "Tue";
      if (key === "availability.blocks.afternoon") return "Afternoon";
      if (key === "availability.blocks.evening") return "Evening";
      if (key === "playerProfile.availabilityPartsTwo") {
        return `${options?.first} & ${options?.second}`;
      }
      if (key === "discover.overlapAvailability") {
        return `${options?.weekday} · ${options?.blocks}`;
      }
      return key;
    }) as unknown as TFunction;

    expect(
      formatOverlapAvailabilityLabel(
        "2026-08-04T13:00:00.000Z",
        "2026-08-04T18:30:00.000Z",
        twoBlockT,
      ),
    ).toBe("Tue · Afternoon & Evening");
  });
});
