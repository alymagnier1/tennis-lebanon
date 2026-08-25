import { describe, expect, it } from "vitest";
import type { MatchHubCard } from "@tennis-lebanon/api";
import { matchTimeWindow } from "./match-invite-filters";

function option(startsAt: string, endsAt: string) {
  return {
    id: startsAt,
    starts_at: startsAt,
    ends_at: endsAt,
    yes_count: 0,
    required_count: 2,
    viewer_vote: null,
  };
}

function hub(overrides: Partial<MatchHubCard>): MatchHubCard {
  return {
    agreed_starts_at: null,
    proposed_times: [],
    ...overrides,
  } as MatchHubCard;
}

describe("matchTimeWindow", () => {
  it("uses the agreed option exactly, duration included", () => {
    expect(
      matchTimeWindow(
        hub({
          agreed_starts_at: "2026-03-17T16:00:00.000Z",
          proposed_times: [
            option("2026-03-17T16:00:00.000Z", "2026-03-17T18:00:00.000Z"),
            option("2026-03-18T16:00:00.000Z", "2026-03-18T17:30:00.000Z"),
          ],
        }),
      ),
    ).toEqual({
      freeFrom: "2026-03-17T16:00:00.000Z",
      freeTo: "2026-03-17T18:00:00.000Z",
    });
  });

  it("spans every option while a flexible match is still voting", () => {
    expect(
      matchTimeWindow(
        hub({
          proposed_times: [
            option("2026-03-18T16:00:00.000Z", "2026-03-18T17:30:00.000Z"),
            option("2026-03-17T14:00:00.000Z", "2026-03-17T15:30:00.000Z"),
            option("2026-03-19T09:00:00.000Z", "2026-03-19T10:30:00.000Z"),
          ],
        }),
      ),
    ).toEqual({
      freeFrom: "2026-03-17T14:00:00.000Z",
      freeTo: "2026-03-19T10:30:00.000Z",
    });
  });

  it("falls back to the span when the agreed hour has no option row left", () => {
    // `agreed_starts_at` survives filtering that drops past `proposed_times`,
    // so it can name an hour with nothing to read a duration from.
    expect(
      matchTimeWindow(
        hub({
          agreed_starts_at: "2026-03-01T16:00:00.000Z",
          proposed_times: [
            option("2026-03-17T16:00:00.000Z", "2026-03-17T18:00:00.000Z"),
          ],
        }),
      ),
    ).toEqual({
      freeFrom: "2026-03-17T16:00:00.000Z",
      freeTo: "2026-03-17T18:00:00.000Z",
    });
  });

  it("returns nothing when the match has no times at all", () => {
    expect(matchTimeWindow(hub({}))).toBeNull();
  });
});
