import { describe, expect, it } from "vitest";
import { expoPushMessage } from "../../../../supabase/functions/_shared/expo-push-message";

/**
 * Guards the shape of every push `process-notifications` sends; its
 * `buildExpoPushMessages` builds each one through `expoPushMessage`. Lives
 * here for the same reason as `invoker-auth.test.ts`: this is the vitest
 * project whose `rootDir` can reach `supabase/functions/_shared`.
 */
describe("expoPushMessage", () => {
  const message = expoPushMessage({
    to: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]",
    title: "Court confirmed",
    body: "See you there",
    data: { deepLink: "/match/abc", kind: "match_court_confirmed" },
  });

  it("sends at high priority, so a sleeping Android phone gets it now", () => {
    expect(message.priority).toBe("high");
  });

  it("does not name an Android channel, so Expo's default channel shows it", () => {
    // A channel the app never created would hide the notification entirely.
    expect(message).not.toHaveProperty("channelId");
  });

  it("keeps the recipient, the copy and the deep link", () => {
    expect(message).toEqual({
      to: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]",
      title: "Court confirmed",
      body: "See you there",
      priority: "high",
      data: { deepLink: "/match/abc", kind: "match_court_confirmed" },
    });
  });
});
