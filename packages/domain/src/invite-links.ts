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
 */
export function buildAndroidInviteIntentUrl(
  token: string,
  fallbackUrl: string,
): string {
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
