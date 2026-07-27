import type { Href } from "expo-router";

export const CREATE_MATCH_ROUTE = "/match/create/details" as Href;
export const CLUBS_ROUTE = "/clubs" as Href;

export function matchInviteRoute(matchId: string): Href {
  return {
    pathname: "/match/[id]/invite",
    params: { id: matchId },
  } as Href;
}

export function matchHubRoute(matchId: string): Href {
  return {
    pathname: "/match/[id]",
    params: { id: matchId },
  } as Href;
}

export function matchBookRoute(matchId: string): Href {
  return {
    pathname: "/match/[id]/book",
    params: { id: matchId },
  } as Href;
}

export function clubDetailRoute(
  clubId: string,
  options?: { matchId?: string },
): Href {
  return {
    pathname: "/clubs/[id]",
    params: {
      id: clubId,
      ...(options?.matchId ? { matchId: options.matchId } : {}),
    },
  } as Href;
}

export function playerReportRoute(playerId: string): Href {
  return {
    pathname: "/player/[id]/report",
    params: { id: playerId },
  } as unknown as Href;
}
