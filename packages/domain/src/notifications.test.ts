import { describe, expect, it } from "vitest";
import {
  buildExpoPushMessages,
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

  it("builds expo push messages without leaking extra fields", () => {
    const messages = buildExpoPushMessages({
      kind: "match_invitation",
      payload: {
        deepLink: "/match/1",
        title: "Invite",
        body: "You were invited",
      },
      tokens: ["ExponentPushToken[abc]", "ExponentPushToken[def]"],
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      to: "ExponentPushToken[abc]",
      title: "Invite",
      body: "You were invited",
      data: {
        deepLink: "/match/1",
        kind: "match_invitation",
      },
    });
  });
});
