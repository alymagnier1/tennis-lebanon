import { describe, expect, it } from "vitest";
import { deviceStorageKey, toSecureStoreKey } from "./device-storage-key";

describe("toSecureStoreKey", () => {
  it("keeps already-valid keys", () => {
    expect(toSecureStoreKey("tennis-lebanon.appearance")).toBe(
      "tennis-lebanon.appearance",
    );
  });

  it("replaces SecureStore-illegal characters such as colons", () => {
    expect(toSecureStoreKey("tennis-lebanon:appearance")).toBe(
      "tennis-lebanon_appearance",
    );
    expect(toSecureStoreKey("tennis-lebanon:onboarding:user-id-here")).toBe(
      "tennis-lebanon_onboarding_user-id-here",
    );
  });

  it("rejects an empty key", () => {
    expect(() => toSecureStoreKey("")).toThrow(/empty/i);
  });
});

describe("deviceStorageKey", () => {
  it("builds a SecureStore-safe scoped key", () => {
    const key = deviceStorageKey("push-nudge", "abc-123");
    expect(key).toBe("tennis-lebanon.push-nudge.abc-123");
    expect(toSecureStoreKey(key)).toBe(key);
  });
});
