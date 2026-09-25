import { describe, expect, it } from "vitest";
import { describeBuildInfo } from "./build-info";

const UPDATE_ID = "01a0da4b-255a-7f91-be6c-b97ddabe3227";

describe("describeBuildInfo", () => {
  it("reports a downloaded update with its ID, runtime and channel", () => {
    expect(
      describeBuildInfo({
        isEnabled: true,
        isEmbeddedLaunch: false,
        runtimeVersion: "0.1.0",
        channel: "staging",
        updateId: UPDATE_ID,
      }),
    ).toEqual({
      source: "update",
      runtime: "0.1.0",
      channel: "staging",
      updateId: UPDATE_ID,
    });
  });

  it("reports the bundle that shipped in the APK as embedded", () => {
    expect(
      describeBuildInfo({
        isEnabled: true,
        isEmbeddedLaunch: true,
        runtimeVersion: "0.1.0",
        channel: "staging",
        updateId: "embedded-id",
      }).source,
    ).toBe("embedded");
  });

  it("says updates are off, and nothing else, when expo-updates is disabled", () => {
    expect(
      describeBuildInfo({
        isEnabled: false,
        isEmbeddedLaunch: true,
        runtimeVersion: "0.1.0",
        channel: "staging",
        updateId: UPDATE_ID,
      }),
    ).toEqual({
      source: "disabled",
      runtime: null,
      channel: null,
      updateId: null,
    });
  });
});
