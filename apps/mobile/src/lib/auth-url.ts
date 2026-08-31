import type { EmailOtpType } from "@supabase/supabase-js";

export type AuthUrlPayload =
  | { kind: "code"; code: string }
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "tokenHash"; tokenHash: string; type: EmailOtpType }
  | { kind: "error"; message: string; code?: string };

/**
 * Expo Go encodes `tennislebanon://...#access_token=` as
 * `/--/auth/callback%23...` or `%2523...`, which expo-router treats as an
 * unmatched path. Turn that back into `/auth/callback?...` before routing.
 */
export function rewriteExpoGoAuthPath(path: string): string {
  let next = path.replace(/%2523/gi, "?").replace(/%23/gi, "?");
  next = next.replace(/auth\/callback#/i, "auth/callback?");
  if (next.startsWith("/--/")) {
    next = next.slice(3);
  }
  return next;
}

function normalizeCallbackPathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isStandaloneAuthCallback(parsed: URL): boolean {
  if (parsed.protocol !== "tennislebanon:") return false;
  const path = normalizeCallbackPathname(parsed.pathname);
  if (parsed.hostname === "auth" && path === "/callback") return true;
  // Some Android builds deliver `tennislebanon://callback?...` (host-only).
  if (parsed.hostname === "callback" && (path === "/" || path === "")) {
    return true;
  }
  return path === "/auth/callback" || path.endsWith("/auth/callback");
}

function isAllowedAuthCallbackUrl(parsed: URL): boolean {
  if (isStandaloneAuthCallback(parsed)) {
    return true;
  }

  // Expo Go does not own `tennislebanon://`. Deep links arrive as
  // `exp://<metro>/--/auth/callback` instead.
  if (
    (parsed.protocol === "exp:" || parsed.protocol === "exps:") &&
    parsed.pathname.endsWith("/auth/callback")
  ) {
    return true;
  }

  if (parsed.protocol !== "http:") return false;
  const isLocalHost =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  return isLocalHost && parsed.pathname === "/auth/callback";
}

export function parseAuthUrl(url: string): AuthUrlPayload {
  try {
    const normalized = rewriteExpoGoAuthPath(url).replace("#", "?");
    const parsed = new URL(normalized);
    if (!isAllowedAuthCallbackUrl(parsed)) {
      return { kind: "error", message: "invalid_auth_link" };
    }
    const error =
      parsed.searchParams.get("error_description") ??
      parsed.searchParams.get("error");

    if (error) {
      return {
        kind: "error",
        message: error,
        code: parsed.searchParams.get("error_code") ?? undefined,
      };
    }

    const code = parsed.searchParams.get("code");
    if (code) return { kind: "code", code };

    const tokenHash = parsed.searchParams.get("token_hash");
    const otpType = parsed.searchParams.get("type");
    if (tokenHash && otpType) {
      const allowed: EmailOtpType[] = [
        "email",
        "signup",
        "invite",
        "recovery",
        "email_change",
        "magiclink",
      ];
      if (allowed.includes(otpType as EmailOtpType)) {
        return {
          kind: "tokenHash",
          tokenHash,
          type: otpType as EmailOtpType,
        };
      }
    }

    const accessToken = parsed.searchParams.get("access_token");
    const refreshToken = parsed.searchParams.get("refresh_token");
    if (accessToken && refreshToken) {
      return { kind: "session", accessToken, refreshToken };
    }
  } catch {
    // Fall through to the safe generic error below.
  }

  return { kind: "error", message: "invalid_auth_link" };
}

/**
 * A redacted description of a callback URL, for the staging error screen.
 *
 * Reports the *shape* only -- scheme, host, path, and which parameter names are
 * present. Never a parameter value: a magic-link callback carries access and
 * refresh tokens, and `CLAUDE.md` forbids surfacing those anywhere.
 *
 * Exists because "this link is invalid" gives no way to tell a rejected URL
 * shape apart from a spent token without a 40-minute rebuild.
 */
export function describeAuthUrl(url: string | null): string {
  if (!url) return "no url delivered";
  const beforeParams = url.split(/[?#]/)[0] ?? "";
  try {
    const parsed = new URL(rewriteExpoGoAuthPath(url).replace("#", "?"));
    const names = [...parsed.searchParams.keys()].sort().join(", ");
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname} [${names || "no params"}]`;
  } catch {
    return `unparseable: ${beforeParams}`;
  }
}
