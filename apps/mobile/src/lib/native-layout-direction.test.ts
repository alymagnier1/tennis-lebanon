import { describe, expect, it } from "vitest";
import { nativeLayoutStartupAction } from "./native-layout-direction";

describe("nativeLayoutStartupAction", () => {
  it("does nothing when native layout is already left to right", () => {
    expect(
      nativeLayoutStartupAction({
        nativeIsRtl: false,
        restartAlreadyTried: false,
      }),
    ).toBe("none");
    expect(
      nativeLayoutStartupAction({
        nativeIsRtl: false,
        restartAlreadyTried: true,
      }),
    ).toBe("none");
  });

  it("restarts once when a launch finds the native flag still on", () => {
    expect(
      nativeLayoutStartupAction({
        nativeIsRtl: true,
        restartAlreadyTried: false,
      }),
    ).toBe("restart");
  });

  it("never restarts in a loop", () => {
    expect(
      nativeLayoutStartupAction({
        nativeIsRtl: true,
        restartAlreadyTried: true,
      }),
    ).toBe("give_up");
  });
});
