import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "./notification-deep-link";

describe("resolveNotificationHref", () => {
  it("routes match notifications to the hub", () => {
    expect(
      resolveNotificationHref({
        deepLink: "/match/d8888888-8888-8888-8888-888888888888",
      }),
    ).toEqual({
      pathname: "/match/[id]",
      params: { id: "d8888888-8888-8888-8888-888888888888" },
    });
  });

  it("routes matches tab deep links", () => {
    expect(resolveNotificationHref({ deepLink: "/matches" })).toBe(
      "/(tabs)/matches",
    );
  });
});
