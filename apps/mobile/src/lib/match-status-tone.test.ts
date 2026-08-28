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

  it("maps in_progress to actionable so the list asks for a result", () => {
    expect(toneForMatchStatus("in_progress")).toBe("actionable");
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

  it("marks hours and clubs reminders as info, not match urgency", () => {
    expect(homeNextActionTone("availability")).toBe("info");
    expect(homeNextActionTone("favoriteClubs")).toBe("info");
  });
});
