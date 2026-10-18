import type {
  CompletedMatchRow,
  MatchInviteInboxRow,
  MyMatchRow,
} from "@tennis-lebanon/api";
import { beirutDateKey } from "./beirut-time";
import type { HomeNextAction, HomeSetupReminders } from "./home-next-actions";

/**
 * "Hasan Kassem" → "Hasan K.". Strangers on Home see a first name and an
 * initial; the full name is one tap away on the profile.
 */
export function shortPlayerName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  const initial = Array.from(parts[parts.length - 1]!)[0] ?? "";
  return `${parts[0]} ${initial.toLocaleUpperCase()}.`;
}

/**
 * "Bassem Khoury" → "Bassem", for "Hello, …" on Home. The greeting shares a
 * row with the photo and the bell, which left room for about five letters of
 * a name after "Hello, " (founder, 2026-10-04).
 */
export function greetingName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? "";
}

/**
 * The to-do card's list. Setup reminders are not to-dos here (they sit under
 * Who's free as one nudge), and a recruit prompt for the match already on the
 * board would repeat the board's own Invite button.
 */
export function homeTodoActions(
  actions: HomeNextAction[],
  boardMatchId: string | null,
): HomeNextAction[] {
  return actions.filter((action) => {
    if (action.kind === "availability" || action.kind === "favoriteClubs") {
      return false;
    }
    if (action.kind === "players" && action.matchId === boardMatchId) {
      return false;
    }
    return true;
  });
}

export type HomeTodoContext = {
  startsAt: string | null;
  clubName: string | null;
  zones: unknown;
};

/** The match a to-do is about, so its row can say when and where. */
export function homeTodoContext(
  action: HomeNextAction,
  sources: {
    invites: MatchInviteInboxRow[];
    matches: MyMatchRow[];
    completed: CompletedMatchRow[];
  },
): HomeTodoContext | null {
  if (!action.matchId) return null;

  if (action.kind === "invite") {
    const invite = sources.invites.find(
      (row) => row.match_id === action.matchId,
    );
    return invite
      ? { startsAt: invite.soonest_time, clubName: null, zones: null }
      : null;
  }

  if (action.kind === "rematch") {
    const done = sources.completed.find(
      (row) => row.match_id === action.matchId,
    );
    return done
      ? { startsAt: done.played_at, clubName: done.club_name, zones: null }
      : null;
  }

  const match = sources.matches.find((row) => row.match_id === action.matchId);
  if (!match) return null;
  const firstPreferred = match.preferred_clubs?.[0]?.name ?? null;
  return {
    startsAt: match.court_starts_at ?? match.soonest_time,
    clubName: match.club_name ?? firstPreferred,
    zones: match.zones,
  };
}

/** One setup reminder at a time: hours first, since they fill Who's free. */
export function homeSetupNudge(
  setup: HomeSetupReminders | undefined,
): "availability" | "favoriteClubs" | null {
  if (!setup) return null;
  if (!setup.hasAvailability) return "availability";
  if (!setup.hasFavoriteClubs) return "favoriteClubs";
  return null;
}

/** Whole days from today to `iso`, both read as Beirut calendar dates. */
export function beirutDayOffset(iso: string, nowIso: string): number {
  const toUtcMidnight = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year!, month! - 1, day!);
  };
  const diff =
    toUtcMidnight(beirutDateKey(iso)) - toUtcMidnight(beirutDateKey(nowIso));
  return Math.round(diff / 86_400_000);
}
