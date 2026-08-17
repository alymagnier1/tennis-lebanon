import type { SemanticTone } from "../theme/tennis-tokens";
import type { HomeNextActionKind } from "./home-next-actions";

export type MatchListBadgeInput = {
  status: string;
  hasCourt?: boolean;
  isStaleWarning?: boolean;
};

export type MatchListBadge = {
  label: string;
  tone: SemanticTone;
};

export function toneForMatchStatus(status: string): SemanticTone {
  switch (status) {
    case "confirmed":
      return "positive";
    case "in_progress":
      return "actionable";
    case "cancelled":
    case "expired":
      return "critical";
    case "booking_pending":
    case "ready_to_book":
      return "actionable";
    case "full":
      return "attention";
    case "open":
    case "draft":
    default:
      return "info";
  }
}

export function buildMatchListBadges(
  match: MatchListBadgeInput,
  labels: {
    courtSecured: string;
    staleWarning: string;
    status: string;
  },
): MatchListBadge[] {
  const badges: MatchListBadge[] = [];

  if (match.hasCourt) {
    badges.push({
      label: labels.courtSecured,
      tone: "positive",
    });
  }

  if (match.isStaleWarning) {
    badges.push({
      label: labels.staleWarning,
      tone: "attention",
    });
  }

  if (badges.length === 0) {
    badges.push({
      label: labels.status,
      tone: toneForMatchStatus(match.status),
    });
  }

  return badges.slice(0, 2);
}

export function homeNextActionTone(kind: HomeNextActionKind): SemanticTone {
  switch (kind) {
    case "invite":
    case "court":
    case "vote":
    case "played":
      return "actionable";
    case "booking":
      return "info";
    case "players":
      return "attention";
    // Positive rather than actionable: nobody is waiting on a rematch, so it
    // should not wear the same urgency as a vote somebody is blocked on.
    case "rematch":
      return "positive";
    default:
      return "info";
  }
}

export function homeNextActionLabelKey(kind: HomeNextActionKind): string {
  switch (kind) {
    case "invite":
      return "home.nextAction.actionInvite";
    case "vote":
      return "home.nextAction.actionVote";
    case "booking":
      return "home.nextAction.actionBooking";
    case "court":
      return "home.nextAction.actionCourt";
    case "played":
      return "home.nextAction.actionPlayed";
    case "players":
      return "home.nextAction.actionPlayers";
    case "rematch":
      return "home.nextAction.actionRematch";
    default:
      return "common.continue";
  }
}
