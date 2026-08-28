import { describe, expect, it } from "vitest";
import { canInviteFromState, invitePlayerState } from "./invite-player-state";

const base = { participants: [], locallyInvitedIds: [], userId: "p1" };

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
        participants: [{ user_id: "p1", status: "invited" }],
      }),
    ).toBe("invited");
  });

  // The hub query has not refetched yet, so the row would otherwise offer a
  // second invite to somebody just invited.
  it("treats a player invited in this session as invited", () => {
    expect(invitePlayerState({ ...base, locallyInvitedIds: ["p1"] })).toBe(
      "invited",
    );
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
      }),
    ).toBe("invite");
  });
});

describe("canInviteFromState", () => {
  it("allows only an untouched player", () => {
    expect(canInviteFromState("invite")).toBe(true);
    expect(canInviteFromState("invited")).toBe(false);
    expect(canInviteFromState("joined")).toBe(false);
    expect(canInviteFromState("requested")).toBe(false);
  });
});
