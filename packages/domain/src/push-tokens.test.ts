import { describe, expect, it } from "vitest";
import {
  isValidDeviceId,
  isValidExpoPushToken,
  normalizePushPlatform,
} from "./push-tokens";

describe("push token helpers", () => {
  it("normalizes supported platforms", () => {
    expect(normalizePushPlatform("IOS")).toBe("ios");
    expect(normalizePushPlatform(" android ")).toBe("android");
    expect(normalizePushPlatform("web")).toBeNull();
  });

  it("validates device ids", () => {
    expect(isValidDeviceId("device-123")).toBe(true);
    expect(isValidDeviceId("")).toBe(false);
    expect(isValidDeviceId("x".repeat(129))).toBe(false);
  });

  it("validates Expo push token shape", () => {
    expect(
      isValidExpoPushToken("ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]"),
    ).toBe(true);
    expect(isValidExpoPushToken("short")).toBe(false);
    expect(isValidExpoPushToken("plain-token-without-brackets")).toBe(false);
  });
});
