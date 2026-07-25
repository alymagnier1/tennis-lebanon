import { describe, expect, it } from "vitest";
import { parseAuthUrl } from "./auth-url";

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

  it("does not follow arbitrary callback destinations", () => {
    expect(parseAuthUrl("https://example.com/redirect")).toEqual({
      kind: "error",
      message: "invalid_auth_link",
    });
  });
});
