import { describe, expect, it } from "vitest";
import {
  settingsScreenAccountTitle,
  settingsScreenAppearanceTitle,
  settingsScreenLanguageTitle,
  settingsScreenPreferencesTitle,
} from "./settings-screen-copy";

const identityT = ((key: string) => key) as never;

describe("settings-screen-copy", () => {
  it("falls back when the locale key is missing", () => {
    expect(settingsScreenPreferencesTitle(identityT)).toBe("Preferences");
    expect(settingsScreenLanguageTitle(identityT)).toBe("Language");
    expect(settingsScreenAppearanceTitle(identityT)).toBe("Appearance");
    expect(settingsScreenAccountTitle(identityT)).toBe("Account");
  });

  it("returns translated titles when present", () => {
    const t = ((key: string) => {
      const map: Record<string, string> = {
        settingsScreenPreferences: "Préférences",
        settingsScreenLanguage: "Langue",
        settingsScreenAppearance: "Apparence",
        settingsScreenAccount: "Compte",
      };
      return map[key] ?? key;
    }) as never;

    expect(settingsScreenPreferencesTitle(t)).toBe("Préférences");
    expect(settingsScreenLanguageTitle(t)).toBe("Langue");
    expect(settingsScreenAppearanceTitle(t)).toBe("Apparence");
    expect(settingsScreenAccountTitle(t)).toBe("Compte");
  });
});
