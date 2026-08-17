import type { Href } from "expo-router";
import type { HomeNextActionKind } from "./home-next-actions";

export const CREATE_MATCH_ROUTE = "/match/create" as Href;
export const CLUBS_ROUTE = "/(tabs)/clubs" as Href;
export const MATCHES_ROUTE = "/(tabs)/matches" as Href;

export function matchInviteRoute(
  matchId: string,
  options?: { invitePlayerId?: string },
): Href {
  return {
    pathname: "/match/[id]/invite",
    params: {
      id: matchId,
      ...(options?.invitePlayerId
        ? { invitePlayerId: options.invitePlayerId }
        : {}),
    },
  } as Href;
}

export function matchHubRoute(matchId: string): Href {
  return {
    pathname: "/match/[id]",
    params: { id: matchId },
  } as Href;
}

export function homeNextActionRoute(
  kind: HomeNextActionKind,
  matchId: string,
): Href {
  if (kind === "players") {
    return matchInviteRoute(matchId);
  }
  // "played" lands on the hub too: the yes/no prompt lives in its banner.
  //
  // "rematch" never reaches here — the card overrides onPress, because it has to
  // fetch the hub and seed a create draft rather than navigate. The hub is a safe
  // fallback if that override is ever dropped.
  return matchHubRoute(matchId);
}

export function matchBookRoute(matchId: string): Href {
  return {
    pathname: "/match/[id]/book",
    params: { id: matchId },
  } as Href;
}

/**
 * `clubId` preselects the venue. The host reaches this from a specific club's
 * card after arranging the court there, so making them pick it again from a
 * list is a step the tap already answered.
 */
export function matchBookExternalRoute(
  matchId: string,
  options?: { clubId?: string },
): Href {
  return {
    pathname: "/match/[id]/book-external",
    params: {
      id: matchId,
      ...(options?.clubId ? { clubId: options.clubId } : {}),
    },
  } as Href;
}

export function matchChatRoute(matchId: string): Href {
  return {
    pathname: "/match/[id]/chat",
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

export function matchCancelRoute(
  matchId: string,
  options: { status: string; bookingStartsAt?: string | null },
): Href {
  return {
    pathname: "/match/[id]/cancel",
    params: {
      id: matchId,
      status: options.status,
      ...(options.bookingStartsAt
        ? { bookingStartsAt: encodeURIComponent(options.bookingStartsAt) }
        : {}),
    },
  } as unknown as Href;
}

export function matchWithdrawRoute(matchId: string): Href {
  return {
    pathname: "/match/[id]/withdraw",
    params: { id: matchId },
  } as unknown as Href;
}
