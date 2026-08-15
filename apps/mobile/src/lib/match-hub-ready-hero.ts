import type { MatchHubCard } from "@tennis-lebanon/api";
import { matchHubLevelSummary } from "./match-hub-summaries";

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

type Translate = (key: string, options?: Record<string, unknown>) => string;

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

export function matchHubReadyChips(
  hub: Pick<MatchHubCard, "format" | "intent" | "min_skill" | "max_skill">,
  t: Translate,
): string[] {
  return [
    t(`formats.${hub.format}`),
    t(`playIntent.${hub.intent}`),
    matchHubLevelSummary(hub, t),
  ].filter(Boolean);
}
