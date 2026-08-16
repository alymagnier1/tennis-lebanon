import type { SemanticTone } from "../theme/tennis-tokens";
import { viewerDeclinedToPlay } from "@tennis-lebanon/domain";

/** Active only needs Upcoming vs Pending submission (result still owed). */
export const ACTIVE_MATCH_GROUPS = ["upcoming", "now"] as const;

export type ActiveMatchGroup = (typeof ACTIVE_MATCH_GROUPS)[number];

export type MatchListAction = {
  labelKey: string;
  tone: SemanticTone;
};

export type MatchTabBadgeCounts = {
  invites: number;
  pending: number;
  upcoming: number;
  /** Invites + pending + upcoming — bottom Matches tab. */
  matchesTab: number;
  /** Pending + upcoming — Active segment. */
  active: number;
};

type ActiveListMatch = {
  status: string;
  viewer_attendance?: string | null;
};

export function isLookingMatchStatus(status: string): boolean {
  return status === "open" || status === "full" || status === "draft";
}

/**
 * Active list rows the viewer still owes a job for. After "I did not play",
 * the match stays in the DB until everyone answers, but it leaves this list.
 */
export function isViewerActiveMatch(match: ActiveListMatch): boolean {
  if (match.status !== "in_progress") return true;
  return !viewerDeclinedToPlay(match.viewer_attendance);
}

/** Now = on court / confirm result. Upcoming = scheduled + still recruiting. */
export function activeMatchGroup(match: ActiveListMatch | string): ActiveMatchGroup {
  const status = typeof match === "string" ? match : match.status;
  const attendance =
    typeof match === "string" ? "unknown" : (match.viewer_attendance ?? "unknown");

  if (status === "in_progress" && !viewerDeclinedToPlay(attendance)) {
    return "now";
  }
  return "upcoming";
}

export function groupActiveMatches<T extends ActiveListMatch>(
  matches: T[],
): Record<ActiveMatchGroup, T[]> {
  const grouped: Record<ActiveMatchGroup, T[]> = {
    now: [],
    upcoming: [],
  };

  for (const match of matches) {
    if (!isViewerActiveMatch(match)) continue;
    grouped[activeMatchGroup(match)].push(match);
  }

  return grouped;
}

/** Inside Upcoming, keep recruiting and scheduled matches visually separate. */
export function splitUpcomingMatches<T extends { status: string }>(
  matches: T[],
): { scheduled: T[]; looking: T[] } {
  const scheduled: T[] = [];
  const looking: T[] = [];

  for (const match of matches) {
    if (isLookingMatchStatus(match.status)) {
      looking.push(match);
    } else {
      scheduled.push(match);
    }
  }

  return { scheduled, looking };
}

export function activeMatchGroupLabelKey(group: ActiveMatchGroup): string {
  switch (group) {
    case "now":
      return "matches.list.sectionNow";
    case "upcoming":
      return "matches.list.sectionUpcoming";
  }
}

/** Short labels for the Active subtabs. */
export function activeMatchGroupTabKey(group: ActiveMatchGroup): string {
  switch (group) {
    case "now":
      return "matches.list.tabNow";
    case "upcoming":
      return "matches.list.tabUpcoming";
  }
}

export function activeMatchGroupEmptyTitleKey(group: ActiveMatchGroup): string {
  switch (group) {
    case "now":
      return "matches.list.emptyNowTitle";
    case "upcoming":
      return "matches.list.emptyUpcomingTitle";
  }
}

export function activeMatchGroupEmptyBodyKey(group: ActiveMatchGroup): string {
  switch (group) {
    case "now":
      return "matches.list.emptyNowBody";
    case "upcoming":
      return "matches.list.emptyUpcomingBody";
  }
}

/** Prefer Upcoming, then Pending — first group that has rows. */
export function defaultActiveMatchGroup(
  grouped: Record<ActiveMatchGroup, unknown[]>,
): ActiveMatchGroup {
  for (const group of ACTIVE_MATCH_GROUPS) {
    if (grouped[group].length > 0) return group;
  }
  return "upcoming";
}

/**
 * Badge counts for the Matches tab and its segments.
 * Upcoming = still open / scheduled. Pending = in_progress (result owed).
 */
export function matchTabBadgeCounts(input: {
  inviteCount: number;
  matches: ActiveListMatch[];
}): MatchTabBadgeCounts {
  const grouped = groupActiveMatches(input.matches);
  const invites = Math.max(0, input.inviteCount);
  const pending = grouped.now.length;
  const upcoming = grouped.upcoming.length;

  return {
    invites,
    pending,
    upcoming,
    matchesTab: invites + pending + upcoming,
    active: pending + upcoming,
  };
}

/** Compact badge label: 1…9, then 9+. */
export function formatTabBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/**
 * List/home card copy is the next job, not the lifecycle name.
 * `in_progress` means confirm attendance/result, not "something is happening".
 */
export function matchListAction(input: {
  status: string;
  isCreator?: boolean;
  viewerAttendance?: string | null;
}): MatchListAction | null {
  switch (input.status) {
    case "in_progress":
      if (viewerDeclinedToPlay(input.viewerAttendance)) {
        return null;
      }
      return {
        labelKey:
          input.viewerAttendance === "attended"
            ? "matches.list.action.submitResult"
            : "matches.list.action.confirmPlayed",
        tone: "actionable",
      };
    case "open":
      return input.isCreator
        ? {
            labelKey: "matches.list.action.invitePlayers",
            tone: "actionable",
          }
        : {
            labelKey: "matches.list.action.waitingPlayers",
            tone: "info",
          };
    case "draft":
      return {
        labelKey: "matches.list.action.finishSetup",
        tone: "actionable",
      };
    case "full":
      return {
        labelKey: "matches.list.action.agreeTime",
        tone: "attention",
      };
    case "ready_to_book":
      return input.isCreator
        ? { labelKey: "matches.list.action.bookCourt", tone: "actionable" }
        : { labelKey: "matches.list.action.timeAgreed", tone: "info" };
    case "booking_pending":
      return { labelKey: "matches.list.action.awaitingClub", tone: "info" };
    case "confirmed":
      return { labelKey: "matches.list.action.matchOn", tone: "positive" };
    default:
      return null;
  }
}

/** Pending-submission cards open the result sheet instead of navigating. */
export function matchListOpensResultSheet(match: ActiveListMatch): boolean {
  if (match.status !== "in_progress") return false;
  return !viewerDeclinedToPlay(match.viewer_attendance);
}

/** Completed matches can still take an optional score after attendance. */
export function completedMatchNeedsScore(match: {
  score?: { sets: unknown[] } | null;
}): boolean {
  return match.score == null;
}

/**
 * Time for the match card center. Prefer the booked court hour — `soonest_time`
 * only includes future proposed slots, so pending-submission cards would
 * otherwise show no time after kickoff.
 */
export function matchListStartsAt(match: {
  court_starts_at?: string | null;
  soonest_time?: string | null;
}): string | null {
  return match.court_starts_at ?? match.soonest_time ?? null;
}
