import { describe, expect, it } from "vitest";
import { resolveServiceKey } from "../../../../supabase/functions/_shared/service-key";

/**
 * Guards the key `process-notifications` uses for database calls. Lives here
 * for the same reason as `invoker-auth.test.ts`: this is the vitest project
 * whose `rootDir` can reach `supabase/functions/_shared`.
 */

const SECRET = "sb_secret_abcdefghijklmnop";
const LEGACY = "eyJhbGciOiJIUzI1NiJ9.legacy.signature";

describe("resolveServiceKey", () => {
  it("uses the default secret key when Supabase injects one", () => {
    expect(
      resolveServiceKey({
        secretKeys: JSON.stringify({ default: SECRET }),
        legacyServiceRoleKey: LEGACY,
      }),
    ).toEqual({ key: SECRET, source: "secret" });
  });

  it("ignores secret keys under other names", () => {
    expect(
      resolveServiceKey({
        secretKeys: JSON.stringify({ billing: SECRET }),
        legacyServiceRoleKey: LEGACY,
      }),
    ).toEqual({ key: LEGACY, source: "legacy_service_role" });
  });

  it("falls back to the legacy key when the new variable is absent", () => {
    expect(
      resolveServiceKey({
        secretKeys: undefined,
        legacyServiceRoleKey: LEGACY,
      }),
    ).toEqual({ key: LEGACY, source: "legacy_service_role" });
  });

  it("falls back rather than throwing on a malformed variable", () => {
    expect(
      resolveServiceKey({
        secretKeys: "{not json",
        legacyServiceRoleKey: LEGACY,
      }),
    ).toEqual({ key: LEGACY, source: "legacy_service_role" });
    expect(
      resolveServiceKey({
        secretKeys: JSON.stringify(["default"]),
        legacyServiceRoleKey: LEGACY,
      }),
    ).toEqual({ key: LEGACY, source: "legacy_service_role" });
  });

  it("returns null when neither key exists", () => {
    expect(
      resolveServiceKey({ secretKeys: "{}", legacyServiceRoleKey: undefined }),
    ).toBeNull();
    expect(
      resolveServiceKey({
        secretKeys: JSON.stringify({ default: "" }),
        legacyServiceRoleKey: "",
      }),
    ).toBeNull();
  });
});
