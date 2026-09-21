import { describe, expect, it } from "vitest";
import {
  hubChromeShowsInReadyHero,
  hubPrimaryActionLabelKey,
  resolveHubChromeAction,
  resolveHubFooterAction,
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

  it("drops chrome Invite while the host has join requests to answer", () => {
    expect(
      resolveHubPrimaryAction({
        joinAction: "none",
        nextAction: "manage_requests",
        showRequestCourt: false,
        showConfirmExternalCourt: false,
        isDraftCreator: false,
        viewerIsCreator: true,
        canInvite: true,
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

describe("resolveHubFooterAction", () => {
  it("puts Invite in the footer while the host is answering requests", () => {
    expect(
      resolveHubFooterAction({
        chromeAction: "none",
        actionsInReadyHero: false,
        canInvite: true,
      }),
    ).toBe("invite");
  });

  it("keeps Invite in the footer instead of swallowing it into the hero", () => {
    expect(
      resolveHubFooterAction({
        chromeAction: "invite",
        actionsInReadyHero: true,
        canInvite: true,
      }),
    ).toBe("invite");
  });

  it("does not invent Invite for a joiner", () => {
    expect(
      resolveHubFooterAction({
        chromeAction: "none",
        actionsInReadyHero: false,
        canInvite: false,
      }),
    ).toBe("none");
  });

  // Frame B: host recruiting with an open seat — sticky Invite only.
  it("puts Invite in the footer while recruiting with an open seat", () => {
    const primary = resolveHubPrimaryAction({
      joinAction: "none",
      nextAction: "awaiting_players",
      showRequestCourt: false,
      showConfirmExternalCourt: false,
      isDraftCreator: false,
      viewerIsCreator: true,
      canInvite: true,
    });
    expect(primary).toBe("invite");
    const chrome = resolveHubChromeAction({
      primaryAction: primary,
      hasPreferredClubs: true,
    });
    expect(chrome).toBe("invite");
    expect(
      resolveHubFooterAction({
        chromeAction: chrome,
        actionsInReadyHero: false,
        canInvite: true,
      }),
    ).toBe("invite");
  });

  // Full singles: clubs own Confirm; footer must not revive Invite.
  it("leaves the footer empty when the roster is full and clubs own Confirm", () => {
    const primary = resolveHubPrimaryAction({
      joinAction: "none",
      nextAction: "request_court",
      showRequestCourt: false,
      showConfirmExternalCourt: true,
      isDraftCreator: false,
      viewerIsCreator: true,
      canInvite: false,
    });
    expect(primary).toBe("confirm_external_court");
    const chrome = resolveHubChromeAction({
      primaryAction: primary,
      hasPreferredClubs: true,
    });
    expect(chrome).toBe("none");
    expect(
      resolveHubFooterAction({
        chromeAction: chrome,
        actionsInReadyHero: false,
        canInvite: false,
      }),
    ).toBe("none");
  });
});

describe("hubChromeShowsInReadyHero", () => {
  it("keeps join and booking on the vs card", () => {
    expect(hubChromeShowsInReadyHero("join")).toBe(true);
    expect(hubChromeShowsInReadyHero("confirm_external_court")).toBe(true);
  });

  it("keeps Invite off the vs card (Frame B footer owns it)", () => {
    expect(hubChromeShowsInReadyHero("invite")).toBe(false);
    expect(hubChromeShowsInReadyHero("none")).toBe(false);
  });
});
