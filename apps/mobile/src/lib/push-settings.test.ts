import { describe, expect, it } from "vitest";
import { derivePushSettingsView, isEnableFailure } from "./push-settings";

describe("derivePushSettingsView", () => {
  it("offers the prompt when permission has never been asked", () => {
    expect(
      derivePushSettingsView({
        permission: { status: "undetermined", canAskAgain: true },
        registration: null,
      }),
    ).toMatchObject({ tone: "off", action: "enable" });
  });

  it("sends a user who already declined to system settings", () => {
    expect(
      derivePushSettingsView({
        permission: { status: "denied", canAskAgain: false },
        registration: "skipped",
      }),
    ).toMatchObject({ tone: "blocked", action: "openSettings" });
  });

  it("reports notifications as on once a device is registered", () => {
    expect(
      derivePushSettingsView({
        permission: { status: "granted", canAskAgain: false },
        registration: "registered",
      }),
    ).toMatchObject({ tone: "on", action: "none" });
  });

  it("does not claim notifications are on when the build has no project id", () => {
    const view = derivePushSettingsView({
      permission: { status: "granted", canAskAgain: false },
      registration: "unconfigured",
    });

    expect(view.tone).toBe("unsupported");
    expect(view.action).toBe("none");
    expect(view.detailKey).toBe("notifications.settings.detailUnconfigured");
  });

  it("keeps the build problem visible even before permission is granted", () => {
    expect(
      derivePushSettingsView({
        permission: { status: "undetermined", canAskAgain: true },
        registration: "unconfigured",
      }),
    ).toMatchObject({ tone: "unsupported", action: "none" });
  });

  it("offers no action on a simulator or on web", () => {
    expect(
      derivePushSettingsView({
        permission: { status: "unsupported", canAskAgain: false },
        registration: null,
      }),
    ).toMatchObject({ tone: "unsupported", action: "none" });
  });

  it("treats a granted permission with no token as unsupported", () => {
    expect(
      derivePushSettingsView({
        permission: { status: "granted", canAskAgain: false },
        registration: "unavailable",
      }),
    ).toMatchObject({ tone: "unsupported", action: "none" });
  });
});

describe("isEnableFailure", () => {
  it("does not treat the user declining as an error", () => {
    expect(isEnableFailure("denied")).toBe(false);
  });

  it("flags configuration and device problems", () => {
    expect(isEnableFailure("unconfigured")).toBe(true);
    expect(isEnableFailure("unavailable")).toBe(true);
  });

  it("stays quiet on success", () => {
    expect(isEnableFailure("registered")).toBe(false);
  });
});
