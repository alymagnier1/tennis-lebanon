export type InvitePlayerState = "invite" | "invited" | "requested" | "joined";

type RosterEntry = {
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
 * `requested` is the only actionable state here, and the action is not an
 * invite — the host accepts or declines it on the match hub, where those
 * buttons already live.
 */
export function invitePlayerState(input: {
  participants: RosterEntry[];
  /** Invited in this session; the hub query has not refetched yet. */
  locallyInvitedIds: string[];
  userId: string;
}): InvitePlayerState {
  const entry = input.participants.find(
    (participant) => participant.user_id === input.userId,
  );

  if (entry?.status === "requested") return "requested";
  if (entry?.status === "accepted") return "joined";
  if (entry?.status === "invited") return "invited";

  return input.locallyInvitedIds.includes(input.userId) ? "invited" : "invite";
}

/** Only an untouched player can be invited from this screen. */
export function canInviteFromState(state: InvitePlayerState): boolean {
  return state === "invite";
}
