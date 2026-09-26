import type { SupabaseClient } from "@supabase/supabase-js";

export type SignOutSteps = {
  auth: Pick<SupabaseClient["auth"], "signOut">;
  unregisterPushToken: () => Promise<void>;
  forgetGoogleAccount: () => Promise<void>;
};

/**
 * Signs this device out and leaves the account's other devices signed in.
 *
 * Supabase's default scope is `global`, which ends every session the account
 * has. On staging (2026-09-26) signing out on one device logged a second
 * device on the same account out 30 seconds later, when its refresh token was
 * refused. `local` ends only this device's session.
 */
export async function signOutThisDevice(steps: SignOutSteps): Promise<void> {
  // First, while the session still exists: deactivating the push token is an
  // authenticated call. A failure must not keep anyone signed in.
  await steps.unregisterPushToken().catch(() => undefined);
  // Without this the next attempt silently reuses the same Google account
  // instead of offering the picker, so "use another email" cannot switch.
  await steps.forgetGoogleAccount();
  const { error } = await steps.auth.signOut({ scope: "local" });
  if (error) throw error;
}
