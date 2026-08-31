import { describe, expect, it } from "vitest";
import { parseAuthUrl, rewriteExpoGoAuthPath } from "./auth-url";

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
