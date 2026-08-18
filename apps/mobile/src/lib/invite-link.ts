import { Share } from "react-native";

export function buildMatchInviteUrl(token: string): string {
  return `tennislebanon:///invite/${token}`;
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

  return typeof message === "string" && message.includes("invite_rate_limited")
    ? "matches.invite.rateLimited"
    : "matches.invite.error";
}
