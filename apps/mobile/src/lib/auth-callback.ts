import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { parseAuthUrl, type AuthUrlPayload } from "./auth-url";

/**
 * `expired` covers a link that timed out *and* one that was superseded:
 * requesting a second sign-in email invalidates the first. That is by far the
 * likelier cause in practice, so it gets copy that says which email to open
 * rather than the generic "invalid or expired".
 */
export type AuthCallbackFailure = "expired" | "generic";

export type AuthCallbackResult =
  { ok: true } | { ok: false; reason: AuthCallbackFailure; message: string };

/** Stable key so the same one-time code is never exchanged twice. */
export function authCallbackDedupeKey(payload: AuthUrlPayload): string | null {
  switch (payload.kind) {
    case "code":
      return `code:${payload.code}`;
    case "session":
      return `session:${payload.accessToken.slice(0, 12)}`;
    case "tokenHash":
      return `token:${payload.tokenHash}:${payload.type}`;
    case "error":
      return null;
  }
}

/**
 * Supabase sends `error_code=otp_expired` on the redirect. The message check is
 * a fallback for the SDK-level errors, which do not always carry a code.
 */
export function authCallbackFailureReason(
  code: string | undefined,
  message: string,
): AuthCallbackFailure {
  if (code === "otp_expired") return "expired";
  return /expired/i.test(message) ? "expired" : "generic";
}

type AuthLikeError = { message: string; code?: string };

/**
 * A failed exchange still counts as success when a session already exists --
 * the deep link can be delivered twice, and the second attempt finds the token
 * already spent even though the player is signed in.
 */
async function resolveFailure(
  supabase: SupabaseClient,
  error: AuthLikeError,
): Promise<AuthCallbackResult> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return { ok: true };
  return {
    ok: false,
    reason: authCallbackFailureReason(error.code, error.message),
    message: error.message,
  };
}

export async function completeAuthFromUrl(
  supabase: SupabaseClient,
  url: string,
): Promise<AuthCallbackResult> {
  const payload = parseAuthUrl(url);

  if (payload.kind === "error") {
    return {
      ok: false,
      reason: authCallbackFailureReason(payload.code, payload.message),
      message: payload.message,
    };
  }

  if (payload.kind === "code") {
    const { error } = await supabase.auth.exchangeCodeForSession(payload.code);
    if (error) return resolveFailure(supabase, error);
    return { ok: true };
  }

  if (payload.kind === "tokenHash") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: payload.tokenHash,
      type: payload.type as EmailOtpType,
    });
    if (error) return resolveFailure(supabase, error);
    return { ok: true };
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
  });
  if (error) return resolveFailure(supabase, error);
  return { ok: true };
}

export async function waitForAuthCallbackUrl(
  liveUrl: string | null,
  getInitialUrl: () => Promise<string | null>,
  attempts = 8,
  delayMs = 250,
): Promise<string | null> {
  for (let i = 0; i < attempts; i += 1) {
    const url = liveUrl ?? (await getInitialUrl());
    if (url) return url;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}
