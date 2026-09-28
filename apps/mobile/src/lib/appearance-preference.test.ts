import { describe, expect, it } from "vitest";
import { parseAppearancePreference } from "./appearance-preference";
import { resolveAppearance } from "../theme/tennis-tokens";

describe("appearance preference", () => {
  it("reads a first launch and unknown values as Light", () => {
    expect(parseAppearancePreference(null)).toBe("light");
    expect(parseAppearancePreference("sepia")).toBe("light");
  });

  it("reads the removed System option as Light", () => {
    expect(parseAppearancePreference("system")).toBe("light");
  });

  it("keeps an explicit choice", () => {
    expect(parseAppearancePreference("dark")).toBe("dark");
    expect(parseAppearancePreference("light")).toBe("light");
    expect(resolveAppearance("dark")).toBe("dark");
  });
});
