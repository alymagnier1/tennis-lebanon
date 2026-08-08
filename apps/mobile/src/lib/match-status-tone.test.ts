import { describe, expect, it } from "vitest";
import {
  buildMatchListBadges,
  homeNextActionTone,
  toneForMatchStatus,
} from "./match-status-tone";

describe("toneForMatchStatus", () => {
  it("maps confirmed to positive", () => {
    expect(toneForMatchStatus("confirmed")).toBe("positive");
  });

  it("maps open to info", () => {
    expect(toneForMatchStatus("open")).toBe("info");
  });
});

describe("buildMatchListBadges", () => {
  it("shows court secured and stale warning together", () => {
    expect(
      buildMatchListBadges(
        { status: "open", hasCourt: true, isStaleWarning: true },
        {
          courtSecured: "Court secured",
          staleWarning: "Expiring soon",
          status: "Open",
        },
      ),
    ).toEqual([
      { label: "Court secured", tone: "positive" },
      { label: "Expiring soon", tone: "attention" },
    ]);
  });

  it("falls back to status badge when no flags", () => {
    expect(
      buildMatchListBadges(
        { status: "open" },
        {
          courtSecured: "Court secured",
          staleWarning: "Expiring soon",
          status: "Open",
        },
      ),
    ).toEqual([{ label: "Open", tone: "info" }]);
  });
});

describe("homeNextActionTone", () => {
  it("marks invite as actionable", () => {
    expect(homeNextActionTone("invite")).toBe("actionable");
  });
});
