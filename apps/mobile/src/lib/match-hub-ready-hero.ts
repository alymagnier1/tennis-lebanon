export type HubVsParticipant = {
  user_id: string;
  display_name: string;
  status: string;
  is_creator?: boolean;
  avatar_path?: string | null;
};

export type HubVsSides = {
  left: HubVsParticipant[];
  right: HubVsParticipant[];
  /** Empty avatar slots still shown so the vs frame reads as full. */
  leftOpen: number;
  rightOpen: number;
};

/** Accepted participants ordered host-first for the ready-to-book vs frame. */
export function acceptedHubParticipants(
  participants: HubVsParticipant[],
): HubVsParticipant[] {
  return participants
    .filter((participant) => participant.status === "accepted")
    .sort(
      (a, b) => Number(Boolean(b.is_creator)) - Number(Boolean(a.is_creator)),
    );
}

/**
 * Split roster into left/right sides for the vs hero.
 * Singles: 1 vs 1. Doubles: 2 vs 2. Open slots fill the short side.
 */
export function pickHubVsSides(
  participants: HubVsParticipant[],
  capacity: number,
): HubVsSides {
  const accepted = acceptedHubParticipants(participants);
  const sideSize = capacity >= 4 ? 2 : 1;
  const left = accepted.slice(0, sideSize);
  const right = accepted.slice(sideSize, sideSize * 2);

  return {
    left,
    right,
    leftOpen: Math.max(0, sideSize - left.length),
    rightOpen: Math.max(0, sideSize - right.length),
  };
}

export function hubOpenSpotCount(sides: HubVsSides): number {
  return sides.leftOpen + sides.rightOpen;
}

/**
 * First-in-queue requester may occupy a dashed slot only when the queue is
 * no longer than the empty seats. Two asks for one seat keep the slot empty
 * so the card never implies a place it cannot honour.
 */
export function pickHubSlotOccupant<T>(
  requests: T[],
  openSpots: number,
): T | null {
  if (requests.length === 0 || openSpots <= 0) return null;
  if (requests.length > openSpots) return null;
  return requests[0] ?? null;
}

export type HubVsSidesWithOccupant = HubVsSides & {
  leftOccupant: HubVsParticipant | null;
  rightOccupant: HubVsParticipant | null;
};

/** Prefer the first empty seat, left column then right. */
export function placeHubVsOccupant(
  sides: HubVsSides,
  occupant: HubVsParticipant | null,
): HubVsSidesWithOccupant {
  if (!occupant) {
    return { ...sides, leftOccupant: null, rightOccupant: null };
  }
  if (sides.leftOpen > 0) {
    return {
      ...sides,
      leftOpen: sides.leftOpen - 1,
      leftOccupant: occupant,
      rightOccupant: null,
    };
  }
  if (sides.rightOpen > 0) {
    return {
      ...sides,
      rightOpen: sides.rightOpen - 1,
      leftOccupant: null,
      rightOccupant: occupant,
    };
  }
  return { ...sides, leftOccupant: null, rightOccupant: null };
}

/**
 * Vs-card label: given name plus family initial, e.g. "Rami N.".
 * A single token stays the given name. Non-Latin scripts keep their letters.
 */
export function shortPlayerLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const given = parts[0]!;
  if (parts.length === 1) return given;
  const initial = Array.from(parts[parts.length - 1]!)[0];
  if (!initial) return given;
  return `${given} ${initial.toLocaleUpperCase()}.`;
}

export function hubSlotDurationMinutes(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): number | null {
  if (!startsAt || !endsAt) return null;
  const ms = Date.parse(endsAt) - Date.parse(startsAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60_000);
}
