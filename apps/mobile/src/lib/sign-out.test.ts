import { AuthError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { signOutThisDevice, type SignOutSteps } from "./sign-out";

function steps(overrides: Partial<SignOutSteps> = {}) {
  const calls: string[] = [];
  const auth = {
    signOut: vi.fn(async (_options?: { scope?: string }) => {
      calls.push("auth.signOut");
      return { error: null };
    }),
  };
  const all = {
    auth,
    unregisterPushToken: vi.fn(async () => {
      calls.push("unregisterPushToken");
    }),
    forgetGoogleAccount: vi.fn(async () => {
      calls.push("forgetGoogleAccount");
    }),
    ...overrides,
  } as SignOutSteps;
  return { all, auth, calls };
}

describe("signOutThisDevice", () => {
  it("ends this device's session only, never the account's other devices", async () => {
    const { all, auth } = steps();

    await signOutThisDevice(all);

    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("deactivates the push token before the session ends", async () => {
    const { all, calls } = steps();

    await signOutThisDevice(all);

    expect(calls).toEqual([
      "unregisterPushToken",
      "forgetGoogleAccount",
      "auth.signOut",
    ]);
  });

  it("still signs out when deactivating the push token fails", async () => {
    const { all, auth } = steps({
      unregisterPushToken: vi.fn(async () => {
        throw new Error("offline");
      }),
    });

    await expect(signOutThisDevice(all)).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("reports a sign-out the server refused", async () => {
    const refused = new AuthError("sign-out failed");
    const { all } = steps({
      auth: { signOut: vi.fn(async () => ({ error: refused })) },
    });

    await expect(signOutThisDevice(all)).rejects.toBe(refused);
  });
});
