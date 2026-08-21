import { describe, expect, it } from "vitest";
import {
  hubPrimaryActionLabelKey,
  resolveHubChromeAction,
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

  it("invites when the host still has open slots even without awaiting_players", () => {
    expect(
      resolveHubPrimaryAction({
        joinAction: "none",
        nextAction: "propose_times",
        showRequestCourt: false,
        showConfirmExternalCourt: false,
        isDraftCreator: false,
        viewerIsCreator: true,
        canInvite: true,
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

describe("resolveHubChromeAction", () => {
  it("drops booking from the chrome when the clubs section owns it", () => {
    expect(
      resolveHubChromeAction({
        primaryAction: "confirm_external_court",
        hasPreferredClubs: true,
      }),
    ).toBe("none");
  });

  it("keeps booking in the chrome when no club section can own it", () => {
    expect(
      resolveHubChromeAction({
        primaryAction: "confirm_external_court",
        hasPreferredClubs: false,
      }),
    ).toBe("confirm_external_court");
  });

  it("leaves every other action alone even with preferred clubs", () => {
    for (const kind of [
      "join",
      "request_join",
      "invite",
      "request_court",
    ] as const) {
      expect(
        resolveHubChromeAction({
          primaryAction: kind,
          hasPreferredClubs: true,
        }),
      ).toBe(kind);
    }
  });

  it("gives the chrome no label once the clubs section owns booking", () => {
    // The footer and the hero both read this, so a suppressed action must also
    // produce no label -- that is what stops the sticky bar rendering a second
    // "I booked a court" beside the section's own Confirm court.
    expect(
      hubPrimaryActionLabelKey(
        resolveHubChromeAction({
          primaryAction: "confirm_external_court",
          hasPreferredClubs: true,
        }),
      ),
    ).toBeNull();
  });
});
