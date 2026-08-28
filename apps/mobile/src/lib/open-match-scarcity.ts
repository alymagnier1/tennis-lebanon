import type { MatchListBadge } from "./match-status-tone";

export function openMatchSpotsLeft(
  participantCount: number,
  capacity: number,
): number {
  if (
    !Number.isFinite(participantCount) ||
    !Number.isFinite(capacity) ||
    capacity <= 0
  ) {
    return 0;
  }
  return Math.max(0, Math.trunc(capacity) - Math.trunc(participantCount));
}

/** Last-seat signal only. "2 spots left" on every singles listing is noise. */
export function isLastOpenMatchSpot(
  participantCount: number,
  capacity: number,
): boolean {
  return openMatchSpotsLeft(participantCount, capacity) === 1;
}

export function openMatchScarcityBadges(
  match: {
    participant_count: number;
    capacity: number;
    court_secured: boolean;
  },
  labels: { oneSpotLeft: string; courtSecured: string },
): MatchListBadge[] | undefined {
  const badges: MatchListBadge[] = [];

  if (isLastOpenMatchSpot(match.participant_count, match.capacity)) {
    badges.push({ label: labels.oneSpotLeft, tone: "attention" });
  }

  if (match.court_secured) {
    badges.push({ label: labels.courtSecured, tone: "positive" });
  }

  return badges.length > 0 ? badges : undefined;
}
