/**
 * Invite links, shared by the mobile share sheet and the public web page.
 *
 * A shared link has to work for somebody who has never installed RacketBound,
 * so what gets shared is an https URL, not the app scheme. The token rides in
 * the fragment (`/invite#<token>`) because browsers never send a fragment to
 * the server: it stays out of hosting request logs and the page can be static.
 */

/** `encode(gen_random_bytes(24), 'hex')` in every migration that mints one. */
const INVITE_TOKEN_PATTERN = /^[0-9a-f]{48}$/;

export const APP_URL_SCHEME = "tennislebanon";
export const ANDROID_PACKAGE = "com.racketbound.app";

export function isInviteToken(value: string): boolean {
  return INVITE_TOKEN_PATTERN.test(value);
}

export function buildInviteWebUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/invite#${token}`;
}

/**
 * The token from `location.hash`, or null when it is missing or not a token.
 * Anything else in the fragment -- a truncated paste, a tracking suffix a
 * messaging app appended -- is a broken link, not a different invite.
 */
export function parseInviteFragment(hash: string): string | null {
  const candidate = hash.replace(/^#/, "").trim().toLowerCase();
  return isInviteToken(candidate) ? candidate : null;
}

/** The in-app route, via the custom scheme. Opens `app/invite/[token].tsx`. */
export function buildInviteAppUrl(token: string): string {
  return `${APP_URL_SCHEME}:///invite/${token}`;
}

/**
 * A Chrome intent URL that opens the app when it is installed and goes to
 * `fallbackUrl` when it is not. A bare custom-scheme link does nothing at all
 * on Android when the app is missing, which is exactly the person this page
 * exists for. Chrome rebuilds the data URI as `tennislebanon:///invite/<token>`.
 *
 * Null for anything that is not a token. The path is interpolated raw, and an
 * `intent:` URL is a structured, semicolon-delimited grammar that Chrome parses
 * into an Android Intent -- so a value carrying `;` or `#` would not be a
 * broken link, it would be extra fields in that intent. Every caller happens to
 * pass a `parseInviteFragment` result today; this makes it safe by construction
 * rather than by the habits of callers.
 */
export function buildAndroidInviteIntentUrl(
  token: string,
  fallbackUrl: string,
): string | null {
  if (!isInviteToken(token)) return null;
  return (
    `intent:///invite/${token}#Intent;` +
    `scheme=${APP_URL_SCHEME};` +
    `package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};` +
    "end"
  );
}

export type InvitePlatform = "android" | "ios" | "desktop";

export function detectInvitePlatform(userAgent: string): InvitePlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "desktop";
}

/**
 * The "Open the app" target for the invite page, or null when there is no app
 * to open on this device (a desktop browser) and the page should say so.
 *
 * On Android the intent URL is used only with a fallback: without one, Chrome
 * sends a missing package to its Play Store listing, and cohort 1 is not on
 * the Play Store.
 */
export function buildInviteOpenAppUrl(
  token: string,
  platform: InvitePlatform,
  getAppUrl: string | null,
): string | null {
  if (platform === "desktop") return null;
  if (platform === "android" && getAppUrl) {
    return buildAndroidInviteIntentUrl(token, getAppUrl);
  }
  return buildInviteAppUrl(token);
}

/** Where the invite page keeps the token for this browser tab. */
export const INVITE_TOKEN_SESSION_KEY = "racketbound.invite-token";

/**
 * The parts of `window` the invite page uses, so the tracking below runs and
 * is tested without a browser. Reading `sessionStorage` itself can throw when
 * storage is disabled, so it is only touched inside a `try`.
 */
export type InviteTokenHost = {
  location: { hash: string; pathname: string };
  readonly sessionStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  history: { replaceState(data: null, unused: string, url: string): void };
  addEventListener(type: "hashchange", listener: () => void): void;
  removeEventListener(type: "hashchange", listener: () => void): void;
};

/** The fragment first, then the copy kept for this tab (Back from "Get the app"). */
export function readInviteToken(host: InviteTokenHost): string | null {
  const fromHash = parseInviteFragment(host.location.hash);
  if (fromHash) return fromHash;
  try {
    const stored = host.sessionStorage.getItem(INVITE_TOKEN_SESSION_KEY);
    return stored ? parseInviteFragment(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the page's token in step with its address bar, now and on every later
 * link opened in the same tab.
 *
 * A token that arrives in the fragment is kept for the tab and removed from
 * the address bar (history, screenshots and error reports read the URL). That
 * leaves the tab on plain `/invite`, so the next invite link opened there only
 * changes the fragment: the browser does not reload, and a page that read the
 * token once kept showing -- and opening -- the previous invite (2026-09-26
 * rehearsal). `hashchange` delivers the new one.
 */
export function watchInviteToken(
  host: InviteTokenHost,
  onToken: (token: string) => void,
): () => void {
  const adoptFromAddressBar = () => {
    const token = parseInviteFragment(host.location.hash);
    // A fragment that is not a token is a broken link, not a new invite.
    if (!token) return;
    try {
      host.sessionStorage.setItem(INVITE_TOKEN_SESSION_KEY, token);
    } catch {
      // Private mode or storage disabled: Back will lose the token, nothing worse.
    }
    host.history.replaceState(null, "", host.location.pathname);
    onToken(token);
  };

  adoptFromAddressBar();
  host.addEventListener("hashchange", adoptFromAddressBar);
  return () => host.removeEventListener("hashchange", adoptFromAddressBar);
}
