import { describe, expect, it } from "vitest";
import { isNativeNotificationsSupported } from "./native-notifications-support";

describe("isNativeNotificationsSupported", () => {
  it("is off on web", () => {
    expect(
      isNativeNotificationsSupported({
        os: "web",
        executionEnvironment: "storeClient",
      }),
    ).toBe(false);
  });

  it("is off in Android Expo Go", () => {
    expect(
      isNativeNotificationsSupported({
        os: "android",
        executionEnvironment: "storeClient",
      }),
    ).toBe(false);
    expect(
      isNativeNotificationsSupported({
        os: "android",
        appOwnership: "expo",
      }),
    ).toBe(false);
  });

  it("stays on for iOS Expo Go and Android development builds", () => {
    expect(
      isNativeNotificationsSupported({
        os: "ios",
        executionEnvironment: "storeClient",
        appOwnership: "expo",
      }),
    ).toBe(true);
    expect(
      isNativeNotificationsSupported({
        os: "android",
        executionEnvironment: "bare",
        appOwnership: null,
      }),
    ).toBe(true);
  });
});
