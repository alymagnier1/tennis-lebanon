import { describe, expect, it } from "vitest";
import { canExtendMatchListing } from "./lifecycle";

describe("match lifecycle", () => {
  it("allows creator to extend stale open matches", () => {
    expect(
      canExtendMatchListing({
        isCreator: true,
        matchStatus: "open",
        isStaleWarning: true,
      }),
    ).toBe(true);
    expect(
      canExtendMatchListing({
        isCreator: false,
        matchStatus: "open",
        isStaleWarning: true,
      }),
    ).toBe(false);
  });
});
