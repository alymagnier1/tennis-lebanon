import { describe, expect, it } from "vitest";
import { resolveHubAgreedStartsAt } from "./hub-agreed-time";

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
        [
          {
            id: "opt-1",
            starts_at: "2026-08-12T18:00:00Z",
            ends_at: "2026-08-12T19:30:00Z",
            yes_count: 2,
            required_count: 2,
            viewer_vote: "yes",
          },
        ],
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
