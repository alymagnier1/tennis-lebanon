import { describe, expect, it } from "vitest";
import { parseHeroFamily } from "./hero-variant";

describe("parseHeroFamily", () => {
  it("pins unknown or empty values to green", () => {
    expect(parseHeroFamily(null)).toBe("green");
    expect(parseHeroFamily(undefined)).toBe("green");
    expect(parseHeroFamily("cycle")).toBe("green");
    expect(parseHeroFamily("green")).toBe("green");
  });

  it("accepts the clay light family", () => {
    expect(parseHeroFamily("light")).toBe("light");
  });
});
