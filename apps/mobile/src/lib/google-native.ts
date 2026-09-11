import { GoogleSignin } from "@react-native-google-signin/google-signin";
import type { GoogleIdTokenSource } from "./google-sign-in";
import { env } from "./env";

/**
 * The only place the Google native SDK is touched.
 *
 * Kept apart from `google-sign-in.ts` so the orchestration and error mapping
 * stay unit-testable: this module pulls in native code and cannot be imported
 * under vitest's node environment.
 */

let configured = false;

function configureOnce(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: env.GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: env.GOOGLE_IOS_CLIENT_ID || undefined,
  });
  configured = true;
}

/**
 * Reads the ID token from the native account sheet.
 *
 * Handles both SDK response shapes: v13+ resolves to
 * `{ type: "success" | "cancelled", data }`, while older versions resolve to
 * the user object directly and *throw* on cancel. Supporting both means a
 * version bump cannot silently turn a cancel into a generic failure.
 */
export const nativeGoogleIdToken: GoogleIdTokenSource = async () => {
  configureOnce();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response: unknown = await GoogleSignin.signIn();

  if (response && typeof response === "object" && "type" in response) {
    const shaped = response as {
      type: string;
      data?: { idToken?: string | null };
    };
    if (shaped.type === "cancelled") return { cancelled: true };
    return { cancelled: false, idToken: shaped.data?.idToken ?? null };
  }

  const legacy = response as { idToken?: string | null } | null;
  return { cancelled: false, idToken: legacy?.idToken ?? null };
};

/**
 * Clears the cached Google account on sign-out, so the next attempt shows the
 * picker instead of silently reusing the previous account. Never throws --
 * failing to clear it must not block signing out of the app.
 */
export async function forgetGoogleAccount(): Promise<void> {
  try {
    configureOnce();
    await GoogleSignin.signOut();
  } catch {
    // Nothing cached, or the SDK is unconfigured. Either way, not a failure.
  }
}
