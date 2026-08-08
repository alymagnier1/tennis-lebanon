import { describe, expect, it } from "vitest";
import type { MatchInviteInboxRow, MyMatchRow } from "@tennis-lebanon/api";
import { deriveHomeNextActions } from "./home-next-actions";
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
    participant_count: 1,
    capacity: 2,
    soonest_time: "2026-08-10T15:00:00.000Z",
    notes: null,
    updated_at: "2026-08-01T12:00:00.000Z",
    listing_expires_at: null,
    is_stale_warning: false,
    can_extend_listing: false,
    has_court: false,
    court_starts_at: null,
    opponent_names: null,
    club_name: null,
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
