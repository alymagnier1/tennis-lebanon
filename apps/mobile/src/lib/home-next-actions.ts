import type { MatchInviteInboxRow, MyMatchRow } from "@tennis-lebanon/api";

export type HomeNextAction = {
  id: string;
  kind: "invite" | "players" | "vote" | "booking" | "court";
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string>;
  matchId: string;
};

const ACTIVE_STATUSES = new Set([
  "open",
  "full",
  "ready_to_book",
  "booking_pending",
  "confirmed",
  "in_progress",
]);

export function deriveHomeNextActions(
  invites: MatchInviteInboxRow[],
  matches: MyMatchRow[],
): HomeNextAction[] {
  const actions: HomeNextAction[] = [];

  if (invites.length > 0) {
    const invite = invites[0]!;
    actions.push({
      id: `invite-${invite.invitation_id}`,
      kind: "invite",
      titleKey: "home.nextAction.inviteTitle",
      bodyKey: "home.nextAction.inviteBody",
      bodyParams: { name: invite.inviter_display_name },
      matchId: invite.match_id,
    });
  }

  for (const match of matches) {
    if (!ACTIVE_STATUSES.has(match.status)) {
      continue;
    }

    if (match.status === "booking_pending") {
      actions.push({
        id: `booking-${match.match_id}`,
        kind: "booking",
        titleKey: "home.nextAction.bookingTitle",
        bodyKey: "home.nextAction.bookingBody",
        matchId: match.match_id,
      });
    } else if (match.status === "ready_to_book" && match.is_creator) {
      actions.push({
        id: `court-${match.match_id}`,
        kind: "court",
        titleKey: "home.nextAction.courtTitle",
        bodyKey: "home.nextAction.courtBody",
        matchId: match.match_id,
      });
    } else if (match.status === "open") {
      // Not "vote on a time": a fixed match has nothing to vote on, and even a
      // flexible one cannot reach agreement until the roster is full. What an
      // open match needs, in either mode, is players.
      actions.push({
        id: `players-${match.match_id}`,
        kind: "players",
        titleKey: "home.nextAction.playersTitle",
        bodyKey: "home.nextAction.playersBody",
        matchId: match.match_id,
      });
    } else if (match.status === "full") {
      // Only a flexible match sits at full — a fixed one goes straight to
      // ready_to_book once it fills, because its time is already agreed.
      actions.push({
        id: `vote-${match.match_id}`,
        kind: "vote",
        titleKey: "home.nextAction.voteTitle",
        bodyKey: "home.nextAction.voteBody",
        matchId: match.match_id,
      });
    }

    if (actions.length >= 3) {
      break;
    }
  }

  return actions.slice(0, 3);
}

export function sortUpcomingMatches(matches: MyMatchRow[]): MyMatchRow[] {
  return [...matches]
    .filter((match) => ACTIVE_STATUSES.has(match.status))
    .sort((left, right) => {
      if (!left.soonest_time && !right.soonest_time) {
        return right.updated_at.localeCompare(left.updated_at);
      }
      if (!left.soonest_time) return 1;
      if (!right.soonest_time) return -1;
      return left.soonest_time.localeCompare(right.soonest_time);
    })
    .slice(0, 2);
}
