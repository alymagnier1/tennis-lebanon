import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Google sign-in via the **native** flow, not `signInWithOAuth`.
 *
 * The OAuth flow would open a browser and come back through
 * `tennislebanon://auth/callback` -- the deep-link path that `auth-callback.ts`
 * exists to make reliable. The native flow hands us an ID token in-process and
 * never leaves the app, so it bypasses that machinery entirely.
 *
 * It also bypasses email: Supabase verifies the token with Google directly, so
 * a player with a Google account can sign in while the transactional sender is
 * still unverified.
 */

export type GoogleSignInFailure =
  "cancelled" | "unavailable" | "noToken" | "failed";

export type GoogleSignInResult =
  { ok: true } | { ok: false; reason: GoogleSignInFailure; detail?: string };

/** What the native step has to produce. Injected so this file stays testable. */
export type GoogleIdTokenSource = () => Promise<
  { cancelled: true } | { cancelled: false; idToken: string | null }
>;

/**
 * Whether to render the button at all.
 *
 * The client id is optional in the env schema so the app boots before the
 * Google console work is done. Without it the SDK throws at `configure`, so
 * an unconfigured build hides the button rather than offering one that fails.
 */
export function isGoogleSignInConfigured(
  webClientId: string | null | undefined,
): boolean {
  return typeof webClientId === "string" && webClientId.trim().length > 0;
}

/**
 * Maps a native SDK error onto something the UI can branch on.
 *
 * `DEVELOPER_ERROR` is the one worth naming: on Android it means the SHA-1
 * fingerprint registered in the Google console does not match the signing key
 * of the installed build. It says nothing else about itself, and it is the
 * failure a new package name produces, so `detail` carries the code through to
 * the non-production diagnostic instead of costing a rebuild to identify.
 */
export function googleSignInFailure(error: unknown): {
  reason: GoogleSignInFailure;
  detail?: string;
} {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : "";

  if (/SIGN_IN_CANCELLED|CANCELED|CANCELLED|-5\b/i.test(code)) {
    return { reason: "cancelled" };
  }
  if (
    /PLAY_SERVICES_NOT_AVAILABLE/i.test(code) ||
    /play services/i.test(message)
  ) {
    return { reason: "unavailable" };
  }
  return { reason: "failed", detail: code || message || undefined };
}

/**
 * Runs the native step, then trades the ID token for a Supabase session.
 *
 * A cancel is not an error: the player backed out of the account sheet and
 * should be returned to the sign-in screen with nothing shown.
 */
export async function completeGoogleSignIn(
  supabase: SupabaseClient,
  getIdToken: GoogleIdTokenSource,
): Promise<GoogleSignInResult> {
  let token: string | null;

  try {
    const outcome = await getIdToken();
    if (outcome.cancelled) return { ok: false, reason: "cancelled" };
    token = outcome.idToken;
  } catch (error) {
    const { reason, detail } = googleSignInFailure(error);
    return { ok: false, reason, detail };
  }

  if (!token) return { ok: false, reason: "noToken" };

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token,
  });

  if (error) {
    return { ok: false, reason: "failed", detail: error.message };
  }

  return { ok: true };
}
