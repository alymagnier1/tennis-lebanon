import { describe, expect, it } from "vitest";
import {
  hubPrimaryActionLabelKey,
  resolveHubPrimaryAction,
} from "./hub-action-bar";

describe("resolveHubPrimaryAction", () => {
  it("prioritises join for a viewer who can join", () => {
    expect(
      resolveHubPrimaryAction({
        joinAction: "join",
        showRequestCourt: false,
        showConfirmExternalCourt: false,
        isDraftCreator: false,
      }),
    ).toBe("join");
  });

  it("routes ready hosts to booked off-app when request court is hidden", () => {
    expect(
      resolveHubPrimaryAction({
        joinAction: "none",
        nextAction: "request_court",
        showRequestCourt: false,
        showConfirmExternalCourt: true,
        isDraftCreator: false,
        viewerIsCreator: true,
      }),
    ).toBe("confirm_external_court");
  });

  it("routes recruiting hosts to invite rather than booking", () => {
    expect(
      resolveHubPrimaryAction({
        joinAction: "none",
        nextAction: "awaiting_players",
        showRequestCourt: false,
        showConfirmExternalCourt: false,
        isDraftCreator: false,
        viewerIsCreator: true,
      }),
    ).toBe("invite");
  });

  it("hides invite and booking CTAs from joiners", () => {
    expect(
      resolveHubPrimaryAction({
        joinAction: "none",
        nextAction: "awaiting_players",
        showRequestCourt: false,
        showConfirmExternalCourt: true,
        isDraftCreator: false,
        viewerIsCreator: false,
      }),
    ).toBe("none");
  });
});

describe("hubPrimaryActionLabelKey", () => {
  it("maps request court", () => {
    expect(hubPrimaryActionLabelKey("request_court")).toBe(
      "matches.hub.requestCourt",
    );
  });
});
