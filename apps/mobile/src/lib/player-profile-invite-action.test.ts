import { describe, expect, it } from "vitest";
import { playerProfileInviteAction } from "./player-profile-invite-action";

describe("playerProfileInviteAction", () => {
  it("creates when there is nothing to invite into", () => {
    expect(playerProfileInviteAction([])).toBe("create");
  });

  it("offers the pick even for a single match", () => {
    // The Discover card invites straight away on one match. Here the sheet
    // still opens, so the match is named before somebody is added to it.
    expect(playerProfileInviteAction([{ match_id: "a" }])).toBe("pick");
  });

  it("offers the pick for several", () => {
    expect(
      playerProfileInviteAction([{ match_id: "a" }, { match_id: "b" }]),
    ).toBe("pick");
  });
});
