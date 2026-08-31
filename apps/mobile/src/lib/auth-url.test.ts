import { describe, expect, it } from "vitest";
import {
  authUrlFromParams,
  describeAuthUrl,
  parseAuthUrl,
  rewriteExpoGoAuthPath,
} from "./auth-url";

describe("parseAuthUrl", () => {
  it("accepts a PKCE callback code", () => {
    expect(parseAuthUrl("tennislebanon://auth/callback?code=abc")).toEqual({
      kind: "code",
      code: "abc",
    });
  });

  it("accepts an implicit callback fragment", () => {
    expect(
      parseAuthUrl(
        "tennislebanon://auth/callback#access_token=access&refresh_token=refresh",
      ),
    ).toEqual({
      kind: "session",
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("accepts a local web callback during Expo web development", () => {
    expect(
      parseAuthUrl("http://127.0.0.1:8081/auth/callback?code=web-dev"),
    ).toEqual({
      kind: "code",
      code: "web-dev",
    });
  });

  it("accepts an Expo Go deep link", () => {
    expect(
      parseAuthUrl("exp://127.0.0.1:8081/--/auth/callback?code=expo-go"),
    ).toEqual({
      kind: "code",
      code: "expo-go",
    });
  });

  it("accepts an Expo Go link whose hash was percent-encoded into the path", () => {
    expect(
      parseAuthUrl(
        "exp://127.0.0.1:8081/--/auth/callback%23access_token=access&refresh_token=refresh",
      ),
    ).toEqual({
      kind: "session",
      accessToken: "access",
      refreshToken: "refresh",
    });
    expect(
      rewriteExpoGoAuthPath(
        "/--/auth/callback%2523access_token=access&refresh_token=refresh",
      ),
    ).toBe("/auth/callback?access_token=access&refresh_token=refresh");
  });

  it("accepts a trailing slash on the standalone callback path", () => {
    expect(parseAuthUrl("tennislebanon://auth/callback/?code=abc")).toEqual({
      kind: "code",
      code: "abc",
    });
  });

  it("accepts Android host-only callback links", () => {
    expect(parseAuthUrl("tennislebanon://callback?code=android")).toEqual({
      kind: "code",
      code: "android",
    });
  });

  it("accepts token_hash magic-link callbacks", () => {
    expect(
      parseAuthUrl(
        "tennislebanon://auth/callback?token_hash=hash123&type=magiclink",
      ),
    ).toEqual({
      kind: "tokenHash",
      tokenHash: "hash123",
      type: "magiclink",
    });
  });

  it("does not follow arbitrary callback destinations", () => {
    expect(parseAuthUrl("https://example.com/redirect")).toEqual({
      kind: "error",
      message: "invalid_auth_link",
    });
  });

  it("carries Supabase's error code so callers can tell expiry apart", () => {
    expect(
      parseAuthUrl(
        "tennislebanon://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).toEqual({
      kind: "error",
      message: "Email link is invalid or has expired",
      code: "otp_expired",
    });
  });
});

describe("describeAuthUrl", () => {
  it("reports the URL shape and parameter names", () => {
    expect(
      describeAuthUrl("tennislebanon://auth/callback?code=abc&state=xyz"),
    ).toBe("tennislebanon://auth/callback [code, state]");
  });

  it("never reveals a token value", () => {
    const secret = "eyJhbGciOiJIUzI1NiJ9.SUPER_SECRET_PAYLOAD.sig";
    const described = describeAuthUrl(
      `tennislebanon://auth/callback#access_token=${secret}&refresh_token=${secret}`,
    );

    expect(described).not.toContain("SUPER_SECRET");
    expect(described).toContain("access_token");
    expect(described).toContain("refresh_token");
  });

  it("distinguishes no URL from an unusable one", () => {
    expect(describeAuthUrl(null)).toBe("no url delivered");
    expect(describeAuthUrl("::::?access_token=secret")).not.toContain("secret");
  });
});

describe("authUrlFromParams", () => {
  it("rebuilds an implicit-flow callback from router params", () => {
    expect(
      authUrlFromParams({
        access_token: "at",
        refresh_token: "rt",
        type: "magiclink",
      }),
    ).toBe(
      "tennislebanon://auth/callback?access_token=at&refresh_token=rt&type=magiclink",
    );
  });

  it("rebuilds a PKCE callback", () => {
    expect(authUrlFromParams({ code: "abc" })).toBe(
      "tennislebanon://auth/callback?code=abc",
    );
  });

  it("carries an error back so the reason survives", () => {
    const url = authUrlFromParams({
      error: "access_denied",
      error_code: "otp_expired",
    });
    expect(parseAuthUrl(url ?? "")).toEqual({
      kind: "error",
      message: "access_denied",
      code: "otp_expired",
    });
  });

  it("ignores a plain visit with no auth params", () => {
    expect(authUrlFromParams({})).toBeNull();
    expect(authUrlFromParams({ unrelated: "x" })).toBeNull();
  });

  it("takes the first value when the router repeats a param", () => {
    expect(authUrlFromParams({ code: ["first", "second"] })).toContain("first");
  });
});
