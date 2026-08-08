import type { MyMatchRow } from "@tennis-lebanon/api";
import { findActiveHostedMatch } from "@tennis-lebanon/domain";
import { matchHubRoute, matchInviteRoute } from "./routes";

export type ActiveHostedMatchRef = {
  matchId: string;
  format: "singles" | "doubles";
  status: string;
};

export function findAnyActiveHostedMatch(
  matches: MyMatchRow[],
): ActiveHostedMatchRef | undefined {
  for (const format of ["singles", "doubles"] as const) {
    const match = findActiveHostedMatch(matches, format);
    if (match) {
      return {
        matchId: match.match_id,
        format,
        status: match.status,
      };
    }
  }
  return undefined;
}

export function activeHostedContinueRoute(
  match: ActiveHostedMatchRef,
): ReturnType<typeof matchInviteRoute> | ReturnType<typeof matchHubRoute> {
  if (match.status === "draft") {
    return matchInviteRoute(match.matchId);
  }
  return matchHubRoute(match.matchId);
}

export function shouldResumeDraftHostedMatch(
  match: ActiveHostedMatchRef,
): boolean {
  return match.status === "draft";
}
