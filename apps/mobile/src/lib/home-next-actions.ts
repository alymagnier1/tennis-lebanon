import type {
  CompletedMatchRow,
  MatchInviteInboxRow,
  MyMatchRow,
} from "@tennis-lebanon/api";
import { canReportMatchPlayed } from "@tennis-lebanon/domain";
import { isLastOpenMatchSpot } from "./open-match-scarcity";

/**
 * Exported so `homeNextActionTone`, `homeNextActionLabelKey` and
 * `homeNextActionRoute` can share it. All three previously re-declared the union
 * inline, which is exactly how a new kind ends up handled in one place and
 * silently defaulted in the others.
 */
export type HomeNextActionKind =
  | "invite"
  | "players"
  | "vote"
  | "booking"
  | "court"
  | "played"
  | "rematch"
  | "availability"
  | "favoriteClubs";

export type HomeNextAction = {
  id: string;
  kind: HomeNextActionKind;
  titleKey: string;
  bodyKey: string;
  /**
   * Interpolated into both the title and the body. Was `bodyParams`, which
   * silently rendered a raw `{{name}}` the moment a title needed one.
   */
  params?: Record<string, string>;
  /** Present for match-lifecycle actions; omitted for profile reminders. */
  matchId?: string;
};

/** Hours and clubs Home should remind about. Omit while those queries are pending. */
export type HomeSetupReminders = {
  hasAvailability: boolean;
  hasFavoriteClubs: boolean;
};

/**
 * How recently a match must have been played for Home to offer a rematch. Set to
 * match hypothesis H1 — second completed match within 14 days — so the surface
 * and the metric measure the same window. Offering one for a match from three
 * months ago reads as the app losing track rather than remembering.
 */
export const REMATCH_OFFER_WINDOW_DAYS = 14;

const ACTIVE_STATUSES = new Set([
  "open",
  "full",
  "ready_to_book",
  "booking_pending",
  "confirmed",
  "in_progress",
]);

/** Home "Upcoming matches" — still ahead, not waiting on a result. */
const UPCOMING_LIST_STATUSES = new Set([
  "open",
  "full",
  "ready_to_book",
  "booking_pending",
  "confirmed",
]);

export function deriveHomeNextActions(
  invites: MatchInviteInboxRow[],
  matches: MyMatchRow[],
  /** Completed matches, for the rematch offer. Optional so existing callers hold. */
  completed: CompletedMatchRow[] = [],
  /** Injected rather than read here, so the function stays pure and testable. */
  nowIso: string = new Date().toISOString(),
  /**
   * Profile reminders. Ranked after live match work and before rematch.
   * Home shows them in a horizontal carousel, not a vertical stack.
   */
  setup?: HomeSetupReminders,
): HomeNextAction[] {
  const actions: HomeNextAction[] = [];

  if (invites.length > 0) {
    const invite = invites[0]!;
    actions.push({
      id: `invite-${invite.invitation_id}`,
      kind: "invite",
      titleKey: "home.nextAction.inviteTitle",
      bodyKey: "home.nextAction.inviteBody",
      params: { name: invite.inviter_display_name },
      matchId: invite.match_id,
    });
  }

  for (const match of matches) {
    if (!ACTIVE_STATUSES.has(match.status)) {
      continue;
    }

    // The hour went by with no court recorded. Asking outranks every other
    // prompt here: the alternative is the match expiring as though it never
    // happened, and only the players know whether it did.
    if (
      canReportMatchPlayed({
        viewerIsParticipant: match.participant_status === "accepted",
        matchStatus: match.status,
        hasAcceptedBooking: match.has_court,
        hasUpcomingTime: Boolean(match.soonest_time),
      })
    ) {
      actions.push({
        id: `played-${match.match_id}`,
        kind: "played",
        titleKey: "home.nextAction.playedTitle",
        bodyKey: "home.nextAction.playedBody",
        matchId: match.match_id,
      });
    } else if (match.status === "booking_pending") {
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
    } else if (match.status === "open" && match.is_creator) {
      // Host-only: joining players cannot invite others. Not "vote on a time"
      // either — an open match needs players first.
      //
      // A court-first match is the same ask with more urgency: the court is
      // already held, so an empty seat costs something. Last seat is the same
      // ask with a true remaining-count, never a fabricated countdown.
      const copy = playersNextActionCopy(match);
      actions.push({
        id: `players-${match.match_id}`,
        kind: "players",
        titleKey: copy.titleKey,
        bodyKey: copy.bodyKey,
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

  // Hours and clubs after anyone waiting on a match, before a rematch.
  // They are skippable Profile editors, not a first-run gate.
  if (setup && actions.length < 3) {
    if (!setup.hasAvailability) {
      actions.push({
        id: "setup-availability",
        kind: "availability",
        titleKey: "home.nextAction.availabilityTitle",
        bodyKey: "home.nextAction.availabilityBody",
      });
    }
    if (!setup.hasFavoriteClubs && actions.length < 3) {
      actions.push({
        id: "setup-favorite-clubs",
        kind: "favoriteClubs",
        titleKey: "home.nextAction.favoriteClubsTitle",
        bodyKey: "home.nextAction.favoriteClubsBody",
      });
    }
  }

  // Ranked last on purpose: an outstanding vote, court request or "did you
  // play?" is something another human is waiting on, and a fresh game is not.
  // The rematch only appears when nothing more urgent fills the three slots.
  if (actions.length < 3) {
    const rematch = mostRecentRematchCandidate(completed, nowIso);
    if (rematch) {
      actions.push({
        id: `rematch-${rematch.match_id}`,
        kind: "rematch",
        titleKey: "home.nextAction.rematchTitle",
        bodyKey: "home.nextAction.rematchBody",
        params: { name: rematch.opponent_names! },
        matchId: rematch.match_id,
      });
    }
  }

  return actions.slice(0, 3);
}

/** First page of the Home carousel. Match work still ranks ahead of setup. */
export function pickHomeHeroAction(
  actions: HomeNextAction[],
): HomeNextAction | null {
  return actions[0] ?? null;
}

export function playersNextActionCopy(match: {
  has_court: boolean;
  participant_count: number;
  capacity: number;
}): { titleKey: string; bodyKey: string } {
  const lastSpot = isLastOpenMatchSpot(match.participant_count, match.capacity);

  if (match.has_court && lastSpot) {
    return {
      titleKey: "home.nextAction.playersCourtOneSpotTitle",
      bodyKey: "home.nextAction.playersCourtOneSpotBody",
    };
  }
  if (match.has_court) {
    return {
      titleKey: "home.nextAction.playersCourtSecuredTitle",
      bodyKey: "home.nextAction.playersCourtSecuredBody",
    };
  }
  if (lastSpot) {
    return {
      titleKey: "home.nextAction.playersOneSpotTitle",
      bodyKey: "home.nextAction.playersOneSpotBody",
    };
  }
  return {
    titleKey: "home.nextAction.playersTitle",
    bodyKey: "home.nextAction.playersBody",
  };
}

/**
 * The newest completed match inside the offer window that has a named opponent.
 *
 * A doubles match yields a comma-joined `opponent_names`, which is fine for the
 * prompt: the hub is fetched on tap and picks the actual opponent from the real
 * roster, so this string is display only.
 */
function mostRecentRematchCandidate(
  completed: CompletedMatchRow[],
  nowIso: string,
): CompletedMatchRow | null {
  const cutoff =
    Date.parse(nowIso) - REMATCH_OFFER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (Number.isNaN(cutoff)) {
    return null;
  }

  return (
    [...completed]
      .filter((match) => {
        if (!match.opponent_names) return false;
        const at = Date.parse(match.completed_at);
        return !Number.isNaN(at) && at >= cutoff;
      })
      .sort((left, right) =>
        right.completed_at.localeCompare(left.completed_at),
      )[0] ?? null
  );
}

export function sortUpcomingMatches(matches: MyMatchRow[]): MyMatchRow[] {
  return [...matches]
    .filter((match) => UPCOMING_LIST_STATUSES.has(match.status))
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
