import { describe, expect, it } from "vitest";
import {
  settingsScreenAccountTitle,
  settingsScreenAppearanceTitle,
  settingsScreenLanguageTitle,
  settingsScreenPreferencesTitle,
  settingsSignInMethod,
} from "./settings-screen-copy";

const identityT = ((key: string) => key) as never;

describe("settings-screen-copy", () => {
  it("falls back when the locale key is missing", () => {
    expect(settingsScreenPreferencesTitle(identityT)).toBe("Preferences");
    expect(settingsScreenLanguageTitle(identityT)).toBe("App language");
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

describe("settingsSignInMethod", () => {
  it("reads as Google when Google is linked, even with a password too", () => {
    expect(settingsSignInMethod(["google"])).toBe("google");
    expect(settingsSignInMethod(["email", "google"])).toBe("google");
  });

  it("reads as email otherwise, including when the providers are missing", () => {
    expect(settingsSignInMethod(["email"])).toBe("email");
    expect(settingsSignInMethod(undefined)).toBe("email");
  });
});
