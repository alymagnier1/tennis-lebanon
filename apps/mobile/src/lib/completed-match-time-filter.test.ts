import { describe, expect, it } from "vitest";
import {
  completedMatchOccurredAt,
  completedTimeFilterCutoff,
  filterCompletedMatchesByTime,
} from "./completed-match-time-filter";

const NOW = new Date("2026-08-16T12:00:00.000Z");

describe("completedMatchOccurredAt", () => {
  it("prefers played_at when present", () => {
    expect(
      completedMatchOccurredAt({
        played_at: "2026-08-01T10:00:00.000Z",
        completed_at: "2026-08-10T10:00:00.000Z",
      }),
    ).toBe("2026-08-01T10:00:00.000Z");
  });
});

describe("completedTimeFilterCutoff", () => {
  it("returns null for all", () => {
    expect(completedTimeFilterCutoff("all", NOW)).toBeNull();
  });

  it("uses rolling day windows", () => {
    expect(completedTimeFilterCutoff("week", NOW)?.toISOString()).toBe(
      "2026-08-09T12:00:00.000Z",
    );
    expect(completedTimeFilterCutoff("month", NOW)?.toISOString()).toBe(
      "2026-07-17T12:00:00.000Z",
    );
    expect(completedTimeFilterCutoff("three_months", NOW)?.toISOString()).toBe(
      "2026-05-18T12:00:00.000Z",
    );
  });
});

describe("filterCompletedMatchesByTime", () => {
  const rows = [
    {
      id: "recent",
      played_at: "2026-08-14T10:00:00.000Z",
      completed_at: "2026-08-14T12:00:00.000Z",
    },
    {
      id: "month",
      played_at: "2026-07-20T10:00:00.000Z",
      completed_at: "2026-07-20T12:00:00.000Z",
    },
    { id: "old", played_at: null, completed_at: "2026-04-01T10:00:00.000Z" },
  ];

  it("keeps everything for all", () => {
    expect(
      filterCompletedMatchesByTime(rows, "all", NOW).map((row) => row.id),
    ).toEqual(["recent", "month", "old"]);
  });

  it("keeps only the last week", () => {
    expect(
      filterCompletedMatchesByTime(rows, "week", NOW).map((row) => row.id),
    ).toEqual(["recent"]);
  });

  it("keeps the last thirty days", () => {
    expect(
      filterCompletedMatchesByTime(rows, "month", NOW).map((row) => row.id),
    ).toEqual(["recent", "month"]);
  });
});
