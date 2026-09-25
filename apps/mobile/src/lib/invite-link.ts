import { Share } from "react-native";
import { buildInviteWebUrl } from "@tennis-lebanon/domain";
import { env } from "./env";

/**
 * The https link to the public invite page, not the app scheme: a shared link
 * is often opened by somebody who does not have the app yet, and
 * `tennislebanon://` does nothing for them. The page hands off to the app.
 */
export function buildMatchInviteUrl(token: string): string {
  return buildInviteWebUrl(env.INVITE_BASE_URL, token);
}

/**
 * Hands the invite link to the OS share sheet.
 *
 * The invite already exists server-side by the time this runs, and the invitee
 * sees it in Matches → Invites whether or not a link is shared. A missing share
 * target — react-native-web rejects when `navigator.share` is absent — or a
 * dismissed sheet must therefore not read as a failed invite, so this never
 * rejects.
 */
export async function shareMatchInvite(message: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch {
    // No share target, or the sheet was dismissed. The invite still stands.
  }
}

/**
 * Which failure copy an invite error deserves. The daily cap is the one case
 * worth naming: retrying will not help until tomorrow.
 *
 * Reads `message` off any shape rather than testing `instanceof Error`, because
 * supabase-js rejects with a plain PostgrestError object — an `instanceof`
 * check silently downgrades every database error to the generic copy.
 */
export function matchInviteErrorKey(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown }).message
      : error;

  if (typeof message !== "string") return "matches.invite.error";

  if (message.includes("invite_rate_limited")) {
    return "matches.invite.rateLimited";
  }
  // Per match, not per day, and the fix is the opposite one: the host does not
  // wait, they withdraw an invitation nobody answered.
  if (message.includes("invite_cap_reached")) {
    return "matches.invite.capReached";
  }
  return "matches.invite.error";
}
