export type InvitePlayerState =
  "invite" | "invited" | "superseded" | "declined" | "requested" | "joined";

type RosterEntry = {
  user_id: string;
  status: string;
};

type InvitedEntry = {
  user_id: string;
  status: string;
};

/**
 * What the invite screen should say about one player.
 *
 * This used to be two states, with `accepted`, `invited` and `requested` all
 * collapsed into "Invited". That inverted the direction of a join request: a
 * player who had asked *you* was shown as though you had asked *them*, and the
 * row that most needed an answer looked like one already dealt with.
 *
 * `requested` is the only actionable state here that is not an invite, and the
 * action is not an invite either — the host accepts or declines it on the match
 * hub, where those buttons already live.
 *
 * **Invitations are read from `invitedPlayers`, never from the roster.**
 * `create_match_invite` writes to `match_invitations` and creates no
 * participant row until the invite is accepted, so the roster cannot answer
 * "did I already ask this person". This resolver previously tried to, backed by
 * a list of ids collected during the current screen session, which meant
 * leaving the screen and returning showed every invited player as invitable
 * again — the exact double-invite `093` was written to stop, reintroduced one
 * layer up.
 *
 * A session-local id list briefly stood in for viewers `get_match_hub` told
 * nothing — it answered the creator alone while any accepted participant may
 * invite. `100` widened the payload to every participant, so there is one
 * source again and the fallback is gone.
 */
export function invitePlayerState(input: {
  participants: RosterEntry[];
  /** `invited_players` from the match hub card. */
  invitedPlayers: InvitedEntry[];
  userId: string;
}): InvitePlayerState {
  const entry = input.participants.find(
    (participant) => participant.user_id === input.userId,
  );

  if (entry?.status === "requested") return "requested";
  if (entry?.status === "accepted") return "joined";
  // Unreachable today: nothing writes a participant row at status `invited`.
  // Kept because the failure mode if one ever appears is offering a second
  // invite to somebody already holding one, which is the bug this resolves.
  if (entry?.status === "invited") return "invited";

  const invited = input.invitedPlayers.find(
    (candidate) => candidate.user_id === input.userId,
  );

  if (invited?.status === "declined") return "declined";
  if (invited?.status === "superseded") return "superseded";
  if (invited) return "invited";

  return "invite";
}

/**
 * Who this screen can send an invite to.
 *
 * `declined` is invitable on purpose. A host who can see that somebody said no
 * and asks anyway has made a deliberate choice, and the row says "Invite again"
 * rather than "Invite" so it cannot be made by accident. Hiding the action
 * instead would remove the only way to re-ask a player who declined.
 *
 * `superseded` is not. The invitation is suspended because the roster filled,
 * and `100` restores it by itself when a seat reopens -- sending another would
 * replace a live offer with an identical one and push a second notification.
 */
export function canInviteFromState(state: InvitePlayerState): boolean {
  return state === "invite" || state === "declined";
}
