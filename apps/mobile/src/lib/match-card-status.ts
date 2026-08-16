import {
  tennisColors,
  tennisSemantic,
  type SemanticTone,
} from "../theme/tennis-tokens";
import { toneForMatchStatus } from "./match-status-tone";

export type MatchCardStatusVisual = {
  dot: string;
  pillBg: string;
  pillText: string;
  border: string;
};

const CONFIRMED: MatchCardStatusVisual = {
  dot: "#22C55E",
  pillBg: "#F0FDF4",
  pillText: "#16A34A",
  border: "#22C55E",
};

const PENDING: MatchCardStatusVisual = {
  dot: "#F59E0B",
  pillBg: "#FFFBEB",
  pillText: "#D97706",
  border: "#F59E0B",
};

const NEUTRAL: MatchCardStatusVisual = {
  dot: "#94A3B8",
  pillBg: "#F1F5F9",
  pillText: "#64748B",
  border: "#E2E8F0",
};

const INFO: MatchCardStatusVisual = {
  dot: tennisColors.primary,
  pillBg: "#E3EDE6",
  pillText: tennisColors.primary,
  border: tennisColors.primary,
};

const ACTIONABLE: MatchCardStatusVisual = {
  dot: tennisSemantic.actionable.border,
  pillBg: tennisSemantic.actionable.fill,
  pillText: tennisSemantic.actionable.text,
  border: tennisSemantic.actionable.border,
};

export function matchCardStatusVisual(status: string): MatchCardStatusVisual {
  switch (status) {
    case "confirmed":
      return CONFIRMED;
    case "in_progress":
      return ACTIONABLE;
    case "booking_pending":
    case "ready_to_book":
    case "full":
      return PENDING;
    case "completed":
    case "cancelled":
    case "expired":
      return NEUTRAL;
    case "open":
    case "draft":
    default:
      return INFO;
  }
}

export function matchCardStatusTone(status: string): SemanticTone {
  return toneForMatchStatus(status);
}

/** Deterministic accent for opponent avatar tiles when no photo exists. */
export function opponentAvatarColor(seed: string): string {
  const palette = [
    "#7C3AED",
    "#2563EB",
    "#059669",
    "#DC2626",
    "#D97706",
    "#0891B2",
  ];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length]!;
}
