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

  it("routes ready hosts to request court", () => {
    expect(
      resolveHubPrimaryAction({
        joinAction: "none",
        nextAction: "ready_to_book",
        showRequestCourt: true,
        showConfirmExternalCourt: false,
        isDraftCreator: false,
      }),
    ).toBe("request_court");
  });
});

describe("hubPrimaryActionLabelKey", () => {
  it("maps request court", () => {
    expect(hubPrimaryActionLabelKey("request_court")).toBe(
      "matches.hub.requestCourt",
    );
  });
});
