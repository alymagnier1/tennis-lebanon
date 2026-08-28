export type AuthUrlPayload =
  | { kind: "code"; code: string }
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string };

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

function isAllowedAuthCallbackUrl(parsed: URL): boolean {
  if (
    parsed.protocol === "tennislebanon:" &&
    parsed.hostname === "auth" &&
    parsed.pathname === "/callback"
  ) {
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
      return { kind: "error", message: error };
    }

    const code = parsed.searchParams.get("code");
    if (code) return { kind: "code", code };

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
