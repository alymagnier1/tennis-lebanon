import { describe, expect, it } from "vitest";
import {
  activeMatchGroup,
  activeMatchGroupLabelKey,
  groupActiveMatches,
  matchListAction,
} from "./match-list-card";

describe("activeMatchGroup", () => {
  it("puts in-progress matches in now", () => {
    expect(activeMatchGroup("in_progress")).toBe("now");
  });

  it("puts recruiting matches in looking", () => {
    expect(activeMatchGroup("open")).toBe("looking");
    expect(activeMatchGroup("full")).toBe("looking");
    expect(activeMatchGroup("draft")).toBe("looking");
  });

  it("puts booked matches in upcoming", () => {
    expect(activeMatchGroup("confirmed")).toBe("upcoming");
    expect(activeMatchGroup("ready_to_book")).toBe("upcoming");
    expect(activeMatchGroup("booking_pending")).toBe("upcoming");
  });
});

describe("groupActiveMatches", () => {
  it("keeps group order and hides nothing that was passed", () => {
    const grouped = groupActiveMatches([
      { id: "a", status: "open" },
      { id: "b", status: "in_progress" },
      { id: "c", status: "confirmed" },
    ]);

    expect(grouped.now.map((row) => row.id)).toEqual(["b"]);
    expect(grouped.upcoming.map((row) => row.id)).toEqual(["c"]);
    expect(grouped.looking.map((row) => row.id)).toEqual(["a"]);
  });
});

describe("activeMatchGroupLabelKey", () => {
  it("points at list section copy", () => {
    expect(activeMatchGroupLabelKey("now")).toBe("matches.list.sectionNow");
  });
});

describe("matchListAction", () => {
  it("asks in-progress players to confirm they played", () => {
    expect(matchListAction({ status: "in_progress" })).toEqual({
      labelKey: "matches.list.action.confirmPlayed",
      tone: "actionable",
    });
  });

  it("asks the host of an open listing to invite", () => {
    expect(matchListAction({ status: "open", isCreator: true })).toEqual({
      labelKey: "matches.list.action.invitePlayers",
      tone: "actionable",
    });
  });

  it("tells a joiner the open listing is still filling", () => {
    expect(matchListAction({ status: "open", isCreator: false })).toEqual({
      labelKey: "matches.list.action.waitingPlayers",
      tone: "info",
    });
  });

  it("leaves unknown statuses to the lifecycle chip", () => {
    expect(matchListAction({ status: "cancelled" })).toBeNull();
  });
});
