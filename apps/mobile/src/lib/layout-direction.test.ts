import { describe, expect, it } from "vitest";
import { resolveLocale } from "./layout-direction";

describe("resolveLocale", () => {
  it("normalizes region subtags", () => {
    expect(resolveLocale("ar-LB")).toBe("ar");
    expect(resolveLocale("fr-FR")).toBe("fr");
  });

  it("falls back to English for unknown locales", () => {
    expect(resolveLocale("de")).toBe("en");
  });
});
