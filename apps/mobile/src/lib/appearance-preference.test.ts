import { describe, expect, it } from "vitest";
import {
  appearanceFromSystem,
  parseAppearancePreference,
} from "./appearance-preference";
import { resolveAppearance } from "../theme/tennis-tokens";

describe("appearance preference", () => {
  it("defaults unknown storage values to system", () => {
    expect(parseAppearancePreference(null)).toBe("system");
    expect(parseAppearancePreference("sepia")).toBe("system");
    expect(parseAppearancePreference("dark")).toBe("dark");
  });

  it("honours an explicit light or dark choice over the OS", () => {
    expect(resolveAppearance("dark", "light")).toBe("dark");
    expect(resolveAppearance("light", "dark")).toBe("light");
  });

  it("follows the OS when the preference is system", () => {
    expect(appearanceFromSystem("system", "dark")).toBe("dark");
    expect(appearanceFromSystem("system", "light")).toBe("light");
    expect(appearanceFromSystem("system", null)).toBe("light");
  });
});
