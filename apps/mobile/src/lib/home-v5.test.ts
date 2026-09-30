import { describe, expect, it } from "vitest";
import type {
  CompletedMatchRow,
  MatchInviteInboxRow,
  MyMatchRow,
} from "@tennis-lebanon/api";
import type { HomeNextAction } from "./home-next-actions";
import {
  beirutDayOffset,
  homeSetupNudge,
  homeTodoActions,
  homeTodoContext,
  ratingPips,
  shortPlayerName,
} from "./home-v5";

function action(overrides: Partial<HomeNextAction>): HomeNextAction {
  return {
    id: "a",
    kind: "vote",
    titleKey: "t",
    bodyKey: "b",
    matchId: "m1",
    ...overrides,
  };
}

function match(overrides: Partial<MyMatchRow> = {}): MyMatchRow {
  return {
    match_id: "m1",
    format: "singles",
    status: "full",
    visibility: "public",
    intent: "either",
    participant_status: "accepted",
    is_creator: true,
    viewer_attendance: null,
    participant_count: 2,
    capacity: 2,
    soonest_time: "2026-08-10T15:00:00.000Z",
    notes: null,
    updated_at: "2026-08-01T12:00:00.000Z",
    listing_expires_at: null,
    is_stale_warning: false,
    can_extend_listing: false,
    unread_message_count: 0,
    pending_request_count: 0,
    has_court: false,
    court_starts_at: null,
    opponent_names: null,
    club_name: null,
    preferred_clubs: null,
    zones: [],
    ...overrides,
  };
}

describe("shortPlayerName", () => {
  it("keeps the first name and the last name's initial", () => {
    expect(shortPlayerName("Hasan Kassem")).toBe("Hasan K.");
    expect(shortPlayerName("  Maya  Abi  Nader ")).toBe("Maya N.");
  });

  it("leaves a single name alone", () => {
    expect(shortPlayerName("Mahdi")).toBe("Mahdi");
    expect(shortPlayerName("   ")).toBe("");
  });

  it("uppercases a lower-case initial", () => {
    expect(shortPlayerName("rami haddad")).toBe("rami H.");
  });
});

describe("homeTodoActions", () => {
  it("drops setup reminders", () => {
    const result = homeTodoActions(
      [
        action({ id: "v", kind: "vote" }),
        action({ id: "h", kind: "availability", matchId: undefined }),
        action({ id: "c", kind: "favoriteClubs", matchId: undefined }),
      ],
      null,
    );
    expect(result.map((item) => item.id)).toEqual(["v"]);
  });

  it("drops the recruit prompt for the match already on the board", () => {
    const result = homeTodoActions(
      [
        action({ id: "p1", kind: "players", matchId: "board" }),
        action({ id: "p2", kind: "players", matchId: "other" }),
      ],
      "board",
    );
    expect(result.map((item) => item.id)).toEqual(["p2"]);
  });
});

describe("homeTodoContext", () => {
  const invite = {
    invitation_id: "i1",
    match_id: "inv",
    soonest_time: "2026-08-12T16:00:00.000Z",
  } as MatchInviteInboxRow;
  const completed = {
    match_id: "done",
    played_at: "2026-08-01T16:00:00.000Z",
    club_name: "JDK",
  } as CompletedMatchRow;

  it("reads a match's court time, then its booked or first preferred club", () => {
    const matches = [
      match({
        match_id: "m1",
        court_starts_at: "2026-08-11T17:00:00.000Z",
        preferred_clubs: [
          { club_id: "c1", name: "Al Riyadi", booking_mode: "whatsapp" },
        ],
      }),
    ];
    expect(
      homeTodoContext(action({ matchId: "m1" }), {
        invites: [],
        matches,
        completed: [],
      }),
    ).toEqual({
      startsAt: "2026-08-11T17:00:00.000Z",
      clubName: "Al Riyadi",
      zones: [],
    });
  });

  it("reads invites and rematches from their own sources", () => {
    const sources = { invites: [invite], matches: [], completed: [completed] };
    expect(
      homeTodoContext(action({ kind: "invite", matchId: "inv" }), sources)
        ?.startsAt,
    ).toBe("2026-08-12T16:00:00.000Z");
    expect(
      homeTodoContext(action({ kind: "rematch", matchId: "done" }), sources)
        ?.clubName,
    ).toBe("JDK");
  });

  it("returns null when the match is not loaded", () => {
    expect(
      homeTodoContext(action({ matchId: "missing" }), {
        invites: [],
        matches: [],
        completed: [],
      }),
    ).toBeNull();
  });
});

describe("homeSetupNudge", () => {
  it("asks for hours before clubs, and nothing once both are set", () => {
    expect(homeSetupNudge(undefined)).toBeNull();
    expect(
      homeSetupNudge({ hasAvailability: false, hasFavoriteClubs: false }),
    ).toBe("availability");
    expect(
      homeSetupNudge({ hasAvailability: true, hasFavoriteClubs: false }),
    ).toBe("favoriteClubs");
    expect(
      homeSetupNudge({ hasAvailability: true, hasFavoriteClubs: true }),
    ).toBeNull();
  });
});

describe("beirutDayOffset", () => {
  it("counts Beirut calendar days, not 24-hour spans", () => {
    // 23:30 Beirut on the 10th, then 00:30 Beirut on the 11th (UTC+3).
    const now = "2026-08-10T20:30:00.000Z";
    expect(beirutDayOffset("2026-08-10T21:30:00.000Z", now)).toBe(1);
    expect(beirutDayOffset("2026-08-10T10:00:00.000Z", now)).toBe(0);
    expect(beirutDayOffset("2026-08-13T10:00:00.000Z", now)).toBe(3);
  });
});

describe("ratingPips", () => {
  it("fills one pip per rated match, clamped to the threshold", () => {
    expect(ratingPips(2, 5)).toEqual([true, true, false, false, false]);
    expect(ratingPips(9, 5)).toEqual([true, true, true, true, true]);
    expect(ratingPips(-1, 3)).toEqual([false, false, false]);
  });
});
