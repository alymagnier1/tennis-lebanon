import { describe, expect, it } from "vitest";
import {
  resolveHubAgreedStartsAt,
  resolveHubEarliestProposedStartsAt,
  resolveHubHeroStartsAt,
} from "./hub-agreed-time";

const opt = (
  id: string,
  startsAt: string,
  endsAt: string,
): {
  id: string;
  starts_at: string;
  ends_at: string;
  yes_count: number;
  required_count: number;
  viewer_vote: "yes" | "no" | null;
} => ({
  id,
  starts_at: startsAt,
  ends_at: endsAt,
  yes_count: 0,
  required_count: 2,
  viewer_vote: null,
});

describe("resolveHubAgreedStartsAt", () => {
  it("prefers agreed_starts_at from the hub card", () => {
    expect(
      resolveHubAgreedStartsAt(
        {
          agreed_starts_at: "2026-08-12T17:00:00Z",
          selected_time_option_id: "opt-1",
        },
        [],
      ),
    ).toBe("2026-08-12T17:00:00Z");
  });

  it("falls back to the selected proposed time", () => {
    expect(
      resolveHubAgreedStartsAt(
        {
          agreed_starts_at: null,
          selected_time_option_id: "opt-1",
        },
        [opt("opt-1", "2026-08-12T18:00:00Z", "2026-08-12T19:30:00Z")],
      ),
    ).toBe("2026-08-12T18:00:00Z");
  });

  it("returns null when nothing is available", () => {
    expect(
      resolveHubAgreedStartsAt(
        { agreed_starts_at: null, selected_time_option_id: null },
        [],
      ),
    ).toBeNull();
  });
});

describe("resolveHubEarliestProposedStartsAt", () => {
  it("picks the earliest starts_at", () => {
    expect(
      resolveHubEarliestProposedStartsAt([
        opt("b", "2026-08-13T16:00:00Z", "2026-08-13T17:00:00Z"),
        opt("a", "2026-08-12T16:00:00Z", "2026-08-12T17:00:00Z"),
      ]),
    ).toBe("2026-08-12T16:00:00Z");
  });

  it("returns null for an empty list", () => {
    expect(resolveHubEarliestProposedStartsAt([])).toBeNull();
  });
});

describe("resolveHubHeroStartsAt", () => {
  it("prefers a locked booking start", () => {
    expect(
      resolveHubHeroStartsAt(
        {
          agreed_starts_at: "2026-08-12T17:00:00Z",
          selected_time_option_id: null,
        },
        [opt("a", "2026-08-11T16:00:00Z", "2026-08-11T17:00:00Z")],
        "2026-08-14T15:00:00Z",
      ),
    ).toBe("2026-08-14T15:00:00Z");
  });

  it("falls back to the earliest proposed when nothing is agreed", () => {
    expect(
      resolveHubHeroStartsAt(
        { agreed_starts_at: null, selected_time_option_id: null },
        [
          opt("b", "2026-08-13T16:00:00Z", "2026-08-13T17:00:00Z"),
          opt("a", "2026-08-12T16:00:00Z", "2026-08-12T17:00:00Z"),
        ],
        null,
      ),
    ).toBe("2026-08-12T16:00:00Z");
  });
});
