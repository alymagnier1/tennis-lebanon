import type { MatchInvitePreview } from "@tennis-lebanon/api";

export type InviteDeclineAction =
  /** Record the refusal on the server: the invitation names this player. */
  | { kind: "refuse"; invitationId: string }
  /** Just leave. Nothing on the server changes. */
  | { kind: "leave" };

/**
 * What Decline does on an invite link.
 *
 * Only an addressed invitation can be refused: it names one player, and
 * `decline_match_invitation` records that player's answer. A shared link names
 * nobody, and refusing it would withdraw it from everyone else it was sent to,
 * so declining one is simply leaving the screen. Every preview carries an
 * `invitation_id`, shared or not, which is why the id alone cannot decide this
 * -- sending every Decline to the server is what made shared links fail.
 *
 * `is_addressed` is null from a server older than migration 108; leaving is the
 * safe reading, since it cannot fail and changes nothing.
 */
export function inviteDeclineAction(
  preview: Pick<MatchInvitePreview, "invitation_id" | "is_addressed">,
): InviteDeclineAction {
  if (preview.is_addressed === true && preview.invitation_id) {
    return { kind: "refuse", invitationId: preview.invitation_id };
  }
  return { kind: "leave" };
}
