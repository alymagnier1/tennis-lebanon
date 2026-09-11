import { describe, expect, it, vi } from "vitest";
import {
  completeGoogleSignIn,
  googleSignInFailure,
  isGoogleSignInConfigured,
} from "./google-sign-in";

function client(
  signInWithIdToken = vi.fn().mockResolvedValue({ error: null }),
) {
  return {
    auth: { signInWithIdToken },
  } as never;
}

describe("isGoogleSignInConfigured", () => {
  it("hides the button until a client id exists", () => {
    expect(isGoogleSignInConfigured(undefined)).toBe(false);
    expect(isGoogleSignInConfigured("")).toBe(false);
    expect(isGoogleSignInConfigured("   ")).toBe(false);
  });

  it("shows it once one does", () => {
    expect(isGoogleSignInConfigured("123.apps.googleusercontent.com")).toBe(
      true,
    );
  });
});

describe("googleSignInFailure", () => {
  it("treats a cancel as its own reason", () => {
    expect(googleSignInFailure({ code: "SIGN_IN_CANCELLED" }).reason).toBe(
      "cancelled",
    );
  });

  it("recognises a device without Play Services", () => {
    expect(
      googleSignInFailure({ code: "PLAY_SERVICES_NOT_AVAILABLE" }).reason,
    ).toBe("unavailable");
  });

  /**
   * DEVELOPER_ERROR means the registered SHA-1 does not match the installed
   * build's signing key. It is the failure a changed package name produces and
   * it explains nothing about itself, so the code has to survive to the UI.
   */
  it("carries DEVELOPER_ERROR through as detail", () => {
    expect(googleSignInFailure({ code: "DEVELOPER_ERROR" })).toEqual({
      reason: "failed",
      detail: "DEVELOPER_ERROR",
    });
  });

  it("falls back to the message when there is no code", () => {
    expect(googleSignInFailure(new Error("network down"))).toEqual({
      reason: "failed",
      detail: "network down",
    });
  });
});

describe("completeGoogleSignIn", () => {
  it("exchanges the id token for a session", async () => {
    const signInWithIdToken = vi.fn().mockResolvedValue({ error: null });

    const result = await completeGoogleSignIn(client(signInWithIdToken), () =>
      Promise.resolve({ cancelled: false, idToken: "tok" }),
    );

    expect(result).toEqual({ ok: true });
    expect(signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: "tok",
    });
  });

  it("reports a cancel without calling Supabase", async () => {
    const signInWithIdToken = vi.fn();

    const result = await completeGoogleSignIn(client(signInWithIdToken), () =>
      Promise.resolve({ cancelled: true }),
    );

    expect(result).toEqual({ ok: false, reason: "cancelled" });
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  it("reports a success with no token rather than calling Supabase with null", async () => {
    const signInWithIdToken = vi.fn();

    const result = await completeGoogleSignIn(client(signInWithIdToken), () =>
      Promise.resolve({ cancelled: false, idToken: null }),
    );

    expect(result).toEqual({ ok: false, reason: "noToken" });
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  it("maps a native throw through the failure mapping", async () => {
    const result = await completeGoogleSignIn(client(), () =>
      Promise.reject({ code: "DEVELOPER_ERROR" }),
    );

    expect(result).toEqual({
      ok: false,
      reason: "failed",
      detail: "DEVELOPER_ERROR",
    });
  });

  it("surfaces a Supabase rejection of the token", async () => {
    const signInWithIdToken = vi
      .fn()
      .mockResolvedValue({ error: { message: "Invalid audience" } });

    const result = await completeGoogleSignIn(client(signInWithIdToken), () =>
      Promise.resolve({ cancelled: false, idToken: "tok" }),
    );

    expect(result).toEqual({
      ok: false,
      reason: "failed",
      detail: "Invalid audience",
    });
  });
});
