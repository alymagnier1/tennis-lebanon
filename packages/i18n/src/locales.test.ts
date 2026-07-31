import { describe, expect, it } from "vitest";
import {
  containsArabicScript,
  containsStaleCopyMarker,
  flattenLocaleStrings,
  IDENTICAL_LOCALE_ALLOWLIST,
  isCriticalFlowKey,
} from "./critical-flow-keys";
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

  it("has no stale placeholder copy in Arabic or French critical flows", () => {
    const english = flattenLocaleStrings(resources.en.translation);
    const arabic = flattenLocaleStrings(resources.ar.translation);
    const french = flattenLocaleStrings(resources.fr.translation);

    for (const key of Object.keys(english)) {
      if (!isCriticalFlowKey(key)) {
        continue;
      }

      const arMarker = containsStaleCopyMarker(arabic[key] ?? "");
      const frMarker = containsStaleCopyMarker(french[key] ?? "");

      expect(arMarker, `${key} Arabic contains stale marker`).toBeNull();
      expect(frMarker, `${key} French contains stale marker`).toBeNull();
    }
  });

  it("translates critical-flow Arabic copy away from English", () => {
    const english = flattenLocaleStrings(resources.en.translation);
    const arabic = flattenLocaleStrings(resources.ar.translation);

    const untranslated: string[] = [];

    for (const key of Object.keys(english)) {
      if (!isCriticalFlowKey(key) || IDENTICAL_LOCALE_ALLOWLIST.has(key)) {
        continue;
      }

      const enValue = english[key] ?? "";
      const arValue = arabic[key] ?? "";

      if (enValue === arValue) {
        untranslated.push(key);
        continue;
      }

      if (!containsArabicScript(arValue)) {
        untranslated.push(key);
      }
    }

    expect(untranslated).toEqual([]);
  });
});
