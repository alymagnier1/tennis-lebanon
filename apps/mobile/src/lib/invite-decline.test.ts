import { describe, expect, it } from "vitest";
import { inviteDeclineAction } from "./invite-decline";

const ID = "3f2d9a4e-1b7c-4c1e-9f0a-6d8e2b4c7a10";

describe("inviteDeclineAction", () => {
  it("refuses an addressed invitation on the server", () => {
    expect(
      inviteDeclineAction({ invitation_id: ID, is_addressed: true }),
    ).toEqual({ kind: "refuse", invitationId: ID });
  });

  it("leaves a shared link without calling the server, even with an id", () => {
    expect(
      inviteDeclineAction({ invitation_id: ID, is_addressed: false }),
    ).toEqual({ kind: "leave" });
  });

  it("leaves when an older server does not say which kind it is", () => {
    expect(
      inviteDeclineAction({ invitation_id: ID, is_addressed: null }),
    ).toEqual({ kind: "leave" });
  });

  it("leaves when there is no invitation to refuse", () => {
    expect(
      inviteDeclineAction({ invitation_id: null, is_addressed: true }),
    ).toEqual({ kind: "leave" });
  });
});
