import { describe, expect, it } from "vitest";
import { resources } from "./index";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("locale resources", () => {
  it("keeps Arabic and French keys aligned with English", () => {
    const english = leafKeys(resources.en.translation).sort();
    expect(leafKeys(resources.ar.translation).sort()).toEqual(english);
    expect(leafKeys(resources.fr.translation).sort()).toEqual(english);
  });
});
