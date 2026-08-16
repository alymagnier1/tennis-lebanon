import type { SemanticTone } from "../theme/tennis-tokens";

export const ACTIVE_MATCH_GROUPS = ["now", "upcoming", "looking"] as const;

export type ActiveMatchGroup = (typeof ACTIVE_MATCH_GROUPS)[number];

export type MatchListAction = {
  labelKey: string;
  tone: SemanticTone;
};

/** Split Active so recruiting is not mixed with matches already on court. */
export function activeMatchGroup(status: string): ActiveMatchGroup {
  if (status === "in_progress") return "now";
  if (status === "open" || status === "full" || status === "draft") {
    return "looking";
  }
  return "upcoming";
}

export function groupActiveMatches<T extends { status: string }>(
  matches: T[],
): Record<ActiveMatchGroup, T[]> {
  const grouped: Record<ActiveMatchGroup, T[]> = {
    now: [],
    upcoming: [],
    looking: [],
  };

  for (const match of matches) {
    grouped[activeMatchGroup(match.status)].push(match);
  }

  return grouped;
}

export function activeMatchGroupLabelKey(group: ActiveMatchGroup): string {
  switch (group) {
    case "now":
      return "matches.list.sectionNow";
    case "upcoming":
      return "matches.list.sectionUpcoming";
    case "looking":
      return "matches.list.sectionLooking";
  }
}

/**
 * List/home card copy is the next job, not the lifecycle name.
 * `in_progress` means confirm attendance/result, not "something is happening".
 */
export function matchListAction(input: {
  status: string;
  isCreator?: boolean;
}): MatchListAction | null {
  switch (input.status) {
    case "in_progress":
      return {
        labelKey: "matches.list.action.confirmPlayed",
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
