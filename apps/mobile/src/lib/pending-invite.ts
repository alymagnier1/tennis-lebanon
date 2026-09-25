import { isInviteToken } from "@tennis-lebanon/domain";
import {
  readDeviceValue,
  removeDeviceValue,
  writeDeviceValue,
} from "./device-storage";

/**
 * Carries an invite link across sign-up and onboarding.
 *
 * Somebody who opens an invite before they have an account is sent to sign in,
 * and the route that held the token is gone by the time onboarding finishes.
 * Without this they land on Home with no idea the invite existed -- the one
 * person a shared link is for. The invite screen remembers the token when it
 * cannot act on it, and the tab layout hands it back once the player is ready.
 *
 * Device-scoped rather than per-user: at the moment it is written there is no
 * user yet. Best effort throughout: a storage failure costs the redirect, never
 * the sign-in.
 */

const PENDING_INVITE_KEY = "tennis-lebanon.pending-invite";

/** Invitations expire after 14 days, so a pending one older than that is dead. */
const PENDING_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type StoredInvite = { token: string; savedAt: number };

function parseStoredInvite(raw: string): StoredInvite | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "token" in value &&
      "savedAt" in value &&
      typeof value.token === "string" &&
      typeof value.savedAt === "number" &&
      isInviteToken(value.token)
    ) {
      return { token: value.token, savedAt: value.savedAt };
    }
  } catch {
    // Unreadable: treat as nothing pending.
  }
  return null;
}

export async function rememberPendingInvite(
  token: string,
  now: number = Date.now(),
): Promise<void> {
  if (!isInviteToken(token)) return;
  const stored: StoredInvite = { token, savedAt: now };
  try {
    await writeDeviceValue(PENDING_INVITE_KEY, JSON.stringify(stored));
  } catch {
    // Best effort; see the module comment.
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await removeDeviceValue(PENDING_INVITE_KEY);
  } catch {
    // Best effort; see the module comment.
  }
}

/**
 * Returns the pending token, if any, and forgets it -- so a redirect happens
 * once, not on every visit to the tabs.
 */
export async function takePendingInvite(
  now: number = Date.now(),
): Promise<string | null> {
  let raw: string | null;
  try {
    raw = await readDeviceValue(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  await clearPendingInvite();

  const stored = parseStoredInvite(raw);
  if (!stored || now - stored.savedAt > PENDING_INVITE_TTL_MS) return null;
  return stored.token;
}
