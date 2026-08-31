import { describe, expect, it, vi } from "vitest";
import {
  authCallbackDedupeKey,
  authCallbackFailureReason,
  completeAuthFromUrl,
} from "./auth-callback";

function clientWithoutSession(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      setSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      ...overrides,
    },
  } as never;
}

describe("authCallbackDedupeKey", () => {
  it("dedupes PKCE codes", () => {
    expect(authCallbackDedupeKey({ kind: "code", code: "abc" })).toBe(
      "code:abc",
    );
  });
});

describe("authCallbackFailureReason", () => {
  it("reads Supabase's structured code", () => {
    expect(authCallbackFailureReason("otp_expired", "anything")).toBe(
      "expired",
    );
  });

  it("falls back to the message when no code is present", () => {
    expect(
      authCallbackFailureReason(
        undefined,
        "Email link is invalid or has expired",
      ),
    ).toBe("expired");
  });

  it("does not treat a malformed link as expired", () => {
    expect(authCallbackFailureReason(undefined, "invalid_auth_link")).toBe(
      "generic",
    );
  });
});

describe("completeAuthFromUrl", () => {
  it("treats a duplicate exchange as success when a session already exists", async () => {
    const exchangeCodeForSession = vi
      .fn()
      .mockResolvedValue({ error: { message: "invalid or expired" } });
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { id: "u1" } } } });

    const result = await completeAuthFromUrl(
      clientWithoutSession({ exchangeCodeForSession, getSession }),
      "tennislebanon://auth/callback?code=abc",
    );

    expect(result).toEqual({ ok: true });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(getSession).toHaveBeenCalled();
  });

  /**
   * The observed pilot failure: a second sign-in email invalidates the first,
   * and Supabase redirects back with `error_code=otp_expired`.
   */
  it("reports a superseded link as expired", async () => {
    const result = await completeAuthFromUrl(
      clientWithoutSession(),
      "tennislebanon://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );

    expect(result).toEqual({
      ok: false,
      reason: "expired",
      message: "Email link is invalid or has expired",
    });
  });

  it("reports an unusable link as generic", async () => {
    const result = await completeAuthFromUrl(
      clientWithoutSession(),
      "https://evil.example.com/auth/callback?code=abc",
    );

    expect(result).toEqual({
      ok: false,
      reason: "generic",
      message: "invalid_auth_link",
    });
  });

  it("reports a spent code as expired when no session results", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
    });

    const result = await completeAuthFromUrl(
      clientWithoutSession({ exchangeCodeForSession }),
      "tennislebanon://auth/callback?code=spent",
    );

    expect(result).toEqual({
      ok: false,
      reason: "expired",
      message: "Token has expired or is invalid",
    });
  });
});
