import type { SemanticTone } from "../theme/tennis-tokens";

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
    case "in_progress":
      return "positive";
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

export function homeNextActionTone(
  kind: "invite" | "players" | "vote" | "booking" | "court" | "played",
): SemanticTone {
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
    default:
      return "info";
  }
}

export function homeNextActionLabelKey(
  kind: "invite" | "players" | "vote" | "booking" | "court" | "played",
): string {
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
    default:
      return "common.continue";
  }
}
