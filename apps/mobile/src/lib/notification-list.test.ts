import { describe, expect, it } from "vitest";
import { NOTIFICATION_KINDS } from "@tennis-lebanon/domain";
import {
  groupNotificationsByDay,
  notificationDayLabel,
  notificationLook,
} from "./notification-list";

// 2026-10-03 15:00 in Beirut (UTC+3).
const NOW = "2026-10-03T12:00:00Z";

describe("notificationDayLabel", () => {
  it("names today, yesterday, the rest of the week, then dates", () => {
    expect(notificationDayLabel("2026-10-03", "2026-10-03")).toEqual({
      kind: "today",
    });
    expect(notificationDayLabel("2026-10-02", "2026-10-03")).toEqual({
      kind: "yesterday",
    });
    expect(notificationDayLabel("2026-09-27", "2026-10-03")).toEqual({
      kind: "weekday",
      dateKey: "2026-09-27",
    });
    expect(notificationDayLabel("2026-09-26", "2026-10-03")).toEqual({
      kind: "date",
      dateKey: "2026-09-26",
    });
  });
});

describe("groupNotificationsByDay", () => {
  it("groups by Beirut day, newest day and newest row first", () => {
    const rows = [
      { id: "older", scheduled_at: "2026-09-26T09:30:00Z" },
      { id: "today-early", scheduled_at: "2026-10-03T06:00:00Z" },
      { id: "yesterday", scheduled_at: "2026-10-02T19:52:00Z" },
      { id: "today-late", scheduled_at: "2026-10-03T11:00:00Z" },
    ];

    const groups = groupNotificationsByDay(rows, NOW);

    expect(groups.map((group) => group.label.kind)).toEqual([
      "today",
      "yesterday",
      "date",
    ]);
    expect(groups[0]?.rows.map((row) => row.id)).toEqual([
      "today-late",
      "today-early",
    ]);
  });

  it("files a late-evening UTC event under the next Beirut day", () => {
    // 22:30 UTC on 10-02 is 01:30 on 10-03 in Beirut.
    const groups = groupNotificationsByDay(
      [{ scheduled_at: "2026-10-02T22:30:00Z" }],
      NOW,
    );

    expect(groups[0]?.label).toEqual({ kind: "today" });
  });

  it("returns no groups for no rows", () => {
    expect(groupNotificationsByDay([], NOW)).toEqual([]);
  });
});

describe("notificationLook", () => {
  it("gives every known kind its own look", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(notificationLook(kind)).not.toEqual(notificationLook("unknown"));
    }
  });

  it("marks what is waiting on the reader as an action", () => {
    expect(notificationLook("match_invitation").tone).toBe("action");
    expect(notificationLook("result_confirm_request").tone).toBe("action");
    expect(notificationLook("match_cancelled").tone).toBe("setback");
    expect(notificationLook("match_court_confirmed").tone).toBe("good");
  });

  it("falls back to a plain bell for a kind this build does not know", () => {
    expect(notificationLook("something_new")).toEqual({
      icon: "notifications",
      tone: "info",
    });
  });
});
