import { describe, expect, it } from "vitest";
import {
  isNotificationKind,
  normalizeNotificationDeepLink,
  parseNotificationPayload,
} from "./notifications";

describe("notifications", () => {
  it("normalizes app scheme deep links", () => {
    expect(normalizeNotificationDeepLink("tennislebanon://match/abc")).toBe(
      "/match/abc",
    );
    expect(normalizeNotificationDeepLink("/match/abc")).toBe("/match/abc");
  });

  it("parses notification payload", () => {
    expect(
      parseNotificationPayload({
        deepLink: "/match/1",
        title: "Hello",
        body: "World",
      }),
    ).toEqual({
      deepLink: "/match/1",
      title: "Hello",
      body: "World",
    });
  });

  it("parses structured params for localized copy", () => {
    expect(
      parseNotificationPayload({
        deepLink: "/match/1",
        params: { clubName: "Hippodrome", startsAt: "2026-08-20T15:00:00Z" },
      })?.params,
    ).toEqual({
      name: undefined,
      clubName: "Hippodrome",
      startsAt: "2026-08-20T15:00:00Z",
      spotsLeft: undefined,
      reason: undefined,
    });
  });

  it("parses a host-removal reason code", () => {
    expect(
      parseNotificationPayload({
        deepLink: "/matches",
        params: { reason: "conduct_issue" },
      })?.params,
    ).toEqual({
      name: undefined,
      clubName: undefined,
      startsAt: undefined,
      spotsLeft: undefined,
      reason: "conduct_issue",
    });
  });

  it("ignores a params object with nothing usable in it", () => {
    expect(
      parseNotificationPayload({ deepLink: "/match/1", params: { junk: 1 } })
        ?.params,
    ).toBeUndefined();
  });

  it("recognises the kinds the database enqueues", () => {
    // The six that were missing for a long time, which is why they rendered
    // untranslated.
    expect(isNotificationKind("match_time_changed")).toBe(true);
    expect(isNotificationKind("match_court_confirmed")).toBe(true);
    expect(isNotificationKind("match_message")).toBe(true);
    expect(isNotificationKind("match_participant_removed")).toBe(true);
    expect(isNotificationKind("not_a_kind")).toBe(false);
  });
});
