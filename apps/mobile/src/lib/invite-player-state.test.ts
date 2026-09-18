import { describe, expect, it } from "vitest";
import { canInviteFromState, invitePlayerState } from "./invite-player-state";

const base = { participants: [], invitedPlayers: [], userId: "p1" };

describe("invitePlayerState", () => {
  it("offers an invite to a player with no row", () => {
    expect(invitePlayerState(base)).toBe("invite");
  });

  // The bug this exists to stop: a player who asked to join read as one the
  // host had invited, which reverses who is waiting on whom.
  it("reports a join request as requested, not invited", () => {
    expect(
      invitePlayerState({
        ...base,
        participants: [{ user_id: "p1", status: "requested" }],
      }),
    ).toBe("requested");
  });

  it("separates a player already in the match from one merely invited", () => {
    expect(
      invitePlayerState({
        ...base,
        participants: [{ user_id: "p1", status: "accepted" }],
      }),
    ).toBe("joined");

    expect(
      invitePlayerState({
        ...base,
        invitedPlayers: [{ user_id: "p1", status: "invited" }],
      }),
    ).toBe("invited");
  });

  // The whole point of reading `invited_players` rather than session state:
  // this survives leaving the screen and coming back, which is when the old
  // resolver started offering a second invite to the same player.
  it("reports a pending invitation from the hub, not from the roster", () => {
    expect(
      invitePlayerState({
        ...base,
        participants: [],
        invitedPlayers: [{ user_id: "p1", status: "invited" }],
      }),
    ).toBe("invited");
  });

  // `099` suspends an invitation while the roster is full. Reporting it as
  // waiting told the host somebody had not answered when the seat they were
  // offered was already taken.
  it("reports a suspended invitation as its own state", () => {
    expect(
      invitePlayerState({
        ...base,
        invitedPlayers: [{ user_id: "p1", status: "superseded" }],
      }),
    ).toBe("superseded");
  });

  it("reports a declined invitation as its own state", () => {
    expect(
      invitePlayerState({
        ...base,
        invitedPlayers: [{ user_id: "p1", status: "declined" }],
      }),
    ).toBe("declined");
  });

  // A player invited first and then arriving under their own steam holds both
  // rows. The participant row is the live fact; the invitation is history.
  it("lets a participant row win over an invitation", () => {
    expect(
      invitePlayerState({
        ...base,
        participants: [{ user_id: "p1", status: "accepted" }],
        invitedPlayers: [{ user_id: "p1", status: "invited" }],
      }),
    ).toBe("joined");

    expect(
      invitePlayerState({
        ...base,
        participants: [{ user_id: "p1", status: "requested" }],
        invitedPlayers: [{ user_id: "p1", status: "invited" }],
      }),
    ).toBe("requested");
  });

  it("ignores a row that left, declined or was removed", () => {
    for (const status of ["left", "declined", "removed"]) {
      expect(
        invitePlayerState({
          ...base,
          participants: [{ user_id: "p1", status }],
        }),
      ).toBe("invite");
    }
  });

  it("ignores other players' rows", () => {
    expect(
      invitePlayerState({
        ...base,
        participants: [{ user_id: "someone-else", status: "requested" }],
        invitedPlayers: [{ user_id: "someone-else", status: "invited" }],
      }),
    ).toBe("invite");
  });
});

describe("canInviteFromState", () => {
  it("allows an untouched player", () => {
    expect(canInviteFromState("invite")).toBe(true);
  });

  // Deliberate, not accidental: the row reads "Invite again", and refusing
  // would leave no way to re-ask somebody who said no.
  it("allows re-inviting a player who declined", () => {
    expect(canInviteFromState("declined")).toBe(true);
  });

  // A suspended invitation restores itself when a seat reopens; sending
  // another would replace a live offer and push a second notification.
  it("refuses a player whose invitation is suspended", () => {
    expect(canInviteFromState("superseded")).toBe(false);
  });

  it("refuses a player already invited, asking, or in the match", () => {
    expect(canInviteFromState("invited")).toBe(false);
    expect(canInviteFromState("joined")).toBe(false);
    expect(canInviteFromState("requested")).toBe(false);
  });
});
