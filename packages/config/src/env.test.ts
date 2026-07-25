import { describe, expect, it } from "vitest";
import { loadClientEnv } from "./env";

const base = {
  EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "publishable-key",
  EXPO_PUBLIC_AUTH_REDIRECT_URL: "tennislebanon://auth/callback",
};

describe("loadClientEnv", () => {
  it("provides a safe local support placeholder", () => {
    const env = loadClientEnv(base, "EXPO_PUBLIC_");
    expect(env.SUPPORT_EMAIL).toBe("support@tennis-lebanon.invalid");
  });

  it("requires a real support path in production", () => {
    expect(() =>
      loadClientEnv(
        { ...base, EXPO_PUBLIC_APP_ENV: "production" },
        "EXPO_PUBLIC_",
      ),
    ).toThrow(/SUPPORT_EMAIL/);
  });

  it("accepts a configured production support path", () => {
    const env = loadClientEnv(
      {
        ...base,
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_SUPPORT_EMAIL: "support@example.com",
      },
      "EXPO_PUBLIC_",
    );
    expect(env.APP_ENV).toBe("production");
  });
});
