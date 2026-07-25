export type AuthUrlPayload =
  | { kind: "code"; code: string }
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string };

function isAllowedAuthCallbackUrl(parsed: URL): boolean {
  if (
    parsed.protocol === "tennislebanon:" &&
    parsed.hostname === "auth" &&
    parsed.pathname === "/callback"
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
    const normalized = url.replace("#", "?");
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
