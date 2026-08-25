import { describe, expect, it } from "vitest";
import {
  activeMatchGroup,
  activeMatchGroupLabelKey,
  activeMatchGroupTabKey,
  defaultActiveMatchGroup,
  formatTabBadgeCount,
  groupActiveMatches,
  matchListAction,
  matchListActionOpensInvite,
  matchListOpensResultSheet,
  matchListStartsAt,
  matchTabBadgeCounts,
  completedMatchNeedsScore,
  splitUpcomingMatches,
} from "./match-list-card";

describe("activeMatchGroup", () => {
  it("puts in-progress matches in now", () => {
    expect(activeMatchGroup("in_progress")).toBe("now");
  });

  it("puts recruiting and scheduled matches in upcoming", () => {
    expect(activeMatchGroup("open")).toBe("upcoming");
    expect(activeMatchGroup("full")).toBe("upcoming");
    expect(activeMatchGroup("draft")).toBe("upcoming");
    expect(activeMatchGroup("confirmed")).toBe("upcoming");
    expect(activeMatchGroup("ready_to_book")).toBe("upcoming");
    expect(activeMatchGroup("booking_pending")).toBe("upcoming");
  });
});

describe("groupActiveMatches", () => {
  it("keeps only Now and Upcoming", () => {
    const grouped = groupActiveMatches([
      { id: "a", status: "open" },
      { id: "b", status: "in_progress" },
      { id: "c", status: "confirmed" },
    ]);

    expect(grouped.now.map((row) => row.id)).toEqual(["b"]);
    expect(grouped.upcoming.map((row) => row.id)).toEqual(["a", "c"]);
  });

  it("drops matches the viewer already marked as not played", () => {
    const grouped = groupActiveMatches([
      { id: "a", status: "in_progress", viewer_attendance: "no_show" },
      { id: "b", status: "in_progress", viewer_attendance: "unknown" },
    ]);

    expect(grouped.now.map((row) => row.id)).toEqual(["b"]);
    expect(grouped.upcoming).toEqual([]);
  });
});

describe("splitUpcomingMatches", () => {
  it("separates looking from scheduled inside Upcoming", () => {
    expect(
      splitUpcomingMatches([
        { id: "a", status: "open" },
        { id: "b", status: "confirmed" },
        { id: "c", status: "draft" },
      ]),
    ).toEqual({
      scheduled: [{ id: "b", status: "confirmed" }],
      looking: [
        { id: "a", status: "open" },
        { id: "c", status: "draft" },
      ],
    });
  });
});

describe("activeMatchGroupLabelKey", () => {
  it("points at list section copy", () => {
    expect(activeMatchGroupLabelKey("now")).toBe("matches.list.sectionNow");
  });
});

describe("activeMatchGroupTabKey", () => {
  it("points at short Active subtab copy", () => {
    expect(activeMatchGroupTabKey("upcoming")).toBe("matches.list.tabUpcoming");
  });
});

describe("defaultActiveMatchGroup", () => {
  it("picks the first non-empty group in Upcoming → Pending order", () => {
    expect(
      defaultActiveMatchGroup({
        now: [{ id: "n" }],
        upcoming: [{ id: "u" }],
      }),
    ).toBe("upcoming");
  });

  it("falls back to upcoming when every group is empty", () => {
    expect(defaultActiveMatchGroup({ now: [], upcoming: [] })).toBe("upcoming");
  });
});

describe("matchListStartsAt", () => {
  it("prefers the booked court hour over a proposed slot", () => {
    expect(
      matchListStartsAt({
        court_starts_at: "2026-08-16T06:20:00.000Z",
        soonest_time: "2026-08-18T15:00:00.000Z",
      }),
    ).toBe("2026-08-16T06:20:00.000Z");
  });

  it("falls back to soonest_time when no court is booked", () => {
    expect(
      matchListStartsAt({
        court_starts_at: null,
        soonest_time: "2026-08-18T15:00:00.000Z",
      }),
    ).toBe("2026-08-18T15:00:00.000Z");
  });
});

describe("matchTabBadgeCounts", () => {
  it("sums invites, pending submission, and upcoming for the Matches tab", () => {
    expect(
      matchTabBadgeCounts({
        inviteCount: 2,
        matches: [
          { status: "open" },
          { status: "confirmed" },
          { status: "in_progress" },
        ],
      }),
    ).toEqual({
      invites: 2,
      pending: 1,
      upcoming: 2,
      matchesTab: 5,
      active: 3,
    });
  });

  it("treats zero invites and empty lists as zero badges", () => {
    expect(matchTabBadgeCounts({ inviteCount: 0, matches: [] })).toEqual({
      invites: 0,
      pending: 0,
      upcoming: 0,
      matchesTab: 0,
      active: 0,
    });
  });
});

describe("formatTabBadgeCount", () => {
  it("hides zero and caps at 9+", () => {
    expect(formatTabBadgeCount(0)).toBeNull();
    expect(formatTabBadgeCount(3)).toBe("3");
    expect(formatTabBadgeCount(9)).toBe("9");
    expect(formatTabBadgeCount(10)).toBe("9+");
  });
});

describe("matchListOpensResultSheet", () => {
  it("opens the sheet only for pending submission", () => {
    expect(matchListOpensResultSheet({ status: "in_progress" })).toBe(true);
    expect(
      matchListOpensResultSheet({
        status: "in_progress",
        viewer_attendance: "no_show",
      }),
    ).toBe(false);
    expect(matchListOpensResultSheet({ status: "confirmed" })).toBe(false);
  });
});

describe("completedMatchNeedsScore", () => {
  it("asks for a score when the completed match has none", () => {
    expect(completedMatchNeedsScore({ score: null })).toBe(true);
    expect(
      completedMatchNeedsScore({
        score: {
          sets: [
            [6, 4],
            [6, 3],
          ],
        },
      }),
    ).toBe(false);
  });
});

describe("matchListAction", () => {
  it("asks in-progress players to confirm they played", () => {
    expect(matchListAction({ status: "in_progress" })).toEqual({
      labelKey: "matches.list.action.confirmPlayed",
      tone: "actionable",
    });
  });

  it("asks for a score after the viewer said they played", () => {
    expect(
      matchListAction({
        status: "in_progress",
        viewerAttendance: "attended",
      }),
    ).toEqual({
      labelKey: "matches.list.action.submitResult",
      tone: "actionable",
    });
  });

  it("hides the action after the viewer said they did not play", () => {
    expect(
      matchListAction({
        status: "in_progress",
        viewerAttendance: "no_show",
      }),
    ).toBeNull();
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

  it("opens the invite screen for a host filling an open or draft match", () => {
    expect(
      matchListActionOpensInvite({ status: "open", isCreator: true }),
    ).toBe(true);
    expect(matchListActionOpensInvite({ status: "draft" })).toBe(true);
    expect(
      matchListActionOpensInvite({ status: "open", isCreator: false }),
    ).toBe(false);
    expect(matchListActionOpensInvite({ status: "confirmed" })).toBe(false);
  });

  it("leaves unknown statuses to the lifecycle chip", () => {
    expect(matchListAction({ status: "cancelled" })).toBeNull();
  });
});
