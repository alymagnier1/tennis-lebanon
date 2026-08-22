import { describe, expect, it } from "vitest";
import type {
  CompletedMatchRow,
  MatchInviteInboxRow,
  MyMatchRow,
} from "@tennis-lebanon/api";
import {
  deriveHomeNextActions,
  sortUpcomingMatches,
} from "./home-next-actions";
import { homeNextActionRoute } from "./routes";

function match(overrides: Partial<MyMatchRow> = {}): MyMatchRow {
  return {
    match_id: "match-1",
    format: "singles",
    status: "open",
    visibility: "public",
    intent: "either",
    participant_status: "accepted",
    is_creator: true,
    viewer_attendance: null,
    participant_count: 1,
    capacity: 2,
    soonest_time: "2026-08-10T15:00:00.000Z",
    notes: null,
    updated_at: "2026-08-01T12:00:00.000Z",
    listing_expires_at: null,
    is_stale_warning: false,
    can_extend_listing: false,
    unread_message_count: 0,
    has_court: false,
    court_starts_at: null,
    opponent_names: null,
    club_name: null,
    preferred_clubs: null,
    zones: [],
    ...overrides,
  };
}

function inboxInvite(
  overrides: Partial<MatchInviteInboxRow> = {},
): MatchInviteInboxRow {
  return {
    invitation_id: "inv-1",
    match_id: "match-invited",
    format: "singles",
    match_status: "open",
    creator_display_name: "Creator",
    inviter_display_name: "Alex",
    participant_count: 1,
    capacity: 2,
    soonest_time: null,
    expires_at: "2026-08-15T12:00:00.000Z",
    created_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

const NOW = "2026-08-17T12:00:00.000Z";

function completedMatch(
  overrides: Partial<CompletedMatchRow> = {},
): CompletedMatchRow {
  return {
    match_id: "match-done",
    format: "singles",
    result_status: null,
    score: null,
    winner_user_id: null,
    viewer_won: null,
    viewer_side: null,
    submitted_by: null,
    submitted_by_name: null,
    opponent_names: "Rami",
    played_at: null,
    club_name: null,
    completed_at: "2026-08-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("rematch offer", () => {
  it("offers the newest recent completed match with a named opponent", () => {
    const actions = deriveHomeNextActions(
      [],
      [],
      [
        completedMatch({
          match_id: "older",
          completed_at: "2026-08-10T12:00:00.000Z",
        }),
        completedMatch({
          match_id: "newer",
          completed_at: "2026-08-16T12:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe("rematch");
    expect(actions[0]?.matchId).toBe("newer");
    // Interpolated into the title as well as the body: the title carries the
    // opponent's name, and passing params to only one of them rendered a raw
    // "{{name}}" on screen.
    expect(actions[0]?.params).toEqual({ name: "Rami" });
    expect(actions[0]?.titleKey).toBe("home.nextAction.rematchTitle");
  });

  it("ignores a match older than the offer window", () => {
    // 14 days matches hypothesis H1, so the surface and the metric agree.
    const actions = deriveHomeNextActions(
      [],
      [],
      [completedMatch({ completed_at: "2026-07-01T12:00:00.000Z" })],
      NOW,
    );

    expect(actions).toEqual([]);
  });

  it("ignores a completed match with nobody to play again", () => {
    expect(
      deriveHomeNextActions(
        [],
        [],
        [completedMatch({ opponent_names: null })],
        NOW,
      ),
    ).toEqual([]);
  });

  it("yields to anything another human is waiting on", () => {
    // Three urgent actions fill the slots; the rematch must not displace them.
    const actions = deriveHomeNextActions(
      [inboxInvite()],
      [
        match({ match_id: "m1", status: "booking_pending" }),
        match({ match_id: "m2", status: "booking_pending" }),
      ],
      [completedMatch()],
      NOW,
    );

    expect(actions).toHaveLength(3);
    expect(actions.map((a) => a.kind)).not.toContain("rematch");
  });

  it("appears alongside urgent actions when there is room", () => {
    const actions = deriveHomeNextActions(
      [inboxInvite()],
      [],
      [completedMatch()],
      NOW,
    );

    expect(actions.map((a) => a.kind)).toEqual(["invite", "rematch"]);
  });

  it("stays absent when no completed matches are passed at all", () => {
    expect(deriveHomeNextActions([], [])).toEqual([]);
  });
});

describe("deriveHomeNextActions", () => {
  it("prioritizes a pending inbox invite", () => {
    const actions = deriveHomeNextActions([inboxInvite()], [match()]);

    expect(actions[0]?.kind).toBe("invite");
    expect(actions[0]?.matchId).toBe("match-invited");
  });

  it("shows waiting for players only for the host of an open match", () => {
    const actions = deriveHomeNextActions(
      [],
      [
        match({ match_id: "host-open", is_creator: true, status: "open" }),
        match({
          match_id: "joined-open",
          is_creator: false,
          status: "open",
        }),
      ],
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe("players");
    expect(actions[0]?.matchId).toBe("host-open");
  });

  // Court-first: the ask is still "find players", but an empty seat now costs
  // a court that is already held, so the copy has to say so.
  it("tells a court-first host the court is already secured", () => {
    const withCourt = deriveHomeNextActions(
      [],
      [match({ status: "open", is_creator: true, has_court: true })],
    );
    const withoutCourt = deriveHomeNextActions(
      [],
      [match({ status: "open", is_creator: true, has_court: false })],
    );

    expect(withCourt[0]?.kind).toBe("players");
    expect(withCourt[0]?.titleKey).toBe(
      "home.nextAction.playersCourtSecuredTitle",
    );
    expect(withoutCourt[0]?.titleKey).toBe("home.nextAction.playersTitle");
  });

  it("shows vote on time for a full flexible match", () => {
    const actions = deriveHomeNextActions(
      [],
      [match({ status: "full", participant_count: 2 })],
    );

    expect(actions[0]?.kind).toBe("vote");
  });

  it("shows book court for a ready_to_book match when the viewer is creator", () => {
    const actions = deriveHomeNextActions(
      [],
      [
        match({
          status: "ready_to_book",
          is_creator: true,
          participant_count: 2,
        }),
      ],
    );

    expect(actions[0]?.kind).toBe("court");
  });

  it("does not show book court for ready_to_book when the viewer is not creator", () => {
    const actions = deriveHomeNextActions(
      [],
      [
        match({
          status: "ready_to_book",
          is_creator: false,
          participant_count: 2,
        }),
      ],
    );

    expect(actions).toHaveLength(0);
  });

  it("caps the queue at three actions", () => {
    const actions = deriveHomeNextActions(
      [inboxInvite()],
      [
        match({ match_id: "m1", status: "booking_pending" }),
        match({ match_id: "m2", status: "ready_to_book" }),
        match({ match_id: "m3", status: "open" }),
        match({ match_id: "m4", status: "full", participant_count: 2 }),
      ],
    );

    expect(actions).toHaveLength(3);
  });
});

describe("sortUpcomingMatches", () => {
  it("excludes in_progress matches waiting on a result", () => {
    const upcoming = sortUpcomingMatches([
      match({
        match_id: "pending",
        status: "in_progress",
        soonest_time: "2026-08-10T12:00:00.000Z",
      }),
      match({
        match_id: "open",
        status: "open",
        soonest_time: "2026-08-18T15:00:00.000Z",
      }),
      match({
        match_id: "confirmed",
        status: "confirmed",
        soonest_time: "2026-08-17T15:00:00.000Z",
      }),
    ]);

    expect(upcoming.map((row) => row.match_id)).toEqual(["confirmed", "open"]);
  });
});

describe("homeNextActionRoute", () => {
  it("deep-links waiting-for-players to the invite screen", () => {
    expect(homeNextActionRoute("players", "abc")).toEqual({
      pathname: "/match/[id]/invite",
      params: { id: "abc" },
    });
  });

  it("routes other kinds to the match hub", () => {
    expect(homeNextActionRoute("vote", "abc")).toEqual({
      pathname: "/match/[id]",
      params: { id: "abc" },
    });
  });
});
