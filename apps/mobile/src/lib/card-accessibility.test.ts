import { describe, expect, it } from "vitest";
import { buildCardAccessibilityLabel } from "./card-accessibility";

describe("buildCardAccessibilityLabel", () => {
  it("joins non-empty parts with commas", () => {
    expect(
      buildCardAccessibilityLabel([
        "Singles · Alex",
        "Intermediate",
        "Beirut",
        undefined,
      ]),
    ).toBe("Singles · Alex, Intermediate, Beirut");
  });

  it("returns an empty string when no parts are provided", () => {
    expect(buildCardAccessibilityLabel(["", "  ", null, undefined])).toBe("");
  });
});
