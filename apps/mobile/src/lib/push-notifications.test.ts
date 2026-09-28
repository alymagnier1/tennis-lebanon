import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExpoPushTokenAsync: vi.fn(),
  registerDevicePushToken: vi.fn(),
  deactivateDevicePushToken: vi.fn(),
  reportError: vi.fn(),
  deviceValues: new Map<string, string>(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  Linking: { openSettings: vi.fn() },
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { eas: { projectId: "project-id" } } } },
}));

vi.mock("expo-device", () => ({ isDevice: true }));

vi.mock("./native-notifications", () => ({
  getNativeNotifications: () => ({
    setNotificationHandler: vi.fn(),
    getPermissionsAsync: vi.fn(async () => ({
      granted: true,
      canAskAgain: false,
    })),
    requestPermissionsAsync: vi.fn(),
    getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
    IosAuthorizationStatus: { PROVISIONAL: 3 },
  }),
}));

vi.mock("@tennis-lebanon/api", () => ({
  registerDevicePushToken: mocks.registerDevicePushToken,
  deactivateDevicePushToken: mocks.deactivateDevicePushToken,
}));

vi.mock("./device-storage", () => ({
  readDeviceValue: vi.fn(
    async (key: string) => mocks.deviceValues.get(key) ?? null,
  ),
  writeDeviceValue: vi.fn(async (key: string, value: string) => {
    mocks.deviceValues.set(key, value);
  }),
  removeDeviceValue: vi.fn(async (key: string) => {
    mocks.deviceValues.delete(key);
  }),
}));

vi.mock("./device-id", () => ({
  getStableDeviceId: vi.fn(async () => "device-1"),
}));

vi.mock("./sentry", () => ({ reportError: mocks.reportError }));

vi.mock("./supabase", () => ({ supabase: {} }));

const EXPO_TOKEN = "ExponentPushToken[abcdefghijklmnopqrstuv]";

describe("syncDevicePushToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deviceValues.clear();
  });

  it("registers the token when permission is already granted", async () => {
    mocks.getExpoPushTokenAsync.mockResolvedValue({ data: EXPO_TOKEN });
    mocks.registerDevicePushToken.mockResolvedValue("row-id");
    const { syncDevicePushToken } = await import("./push-notifications");

    await expect(syncDevicePushToken()).resolves.toBe("registered");
    expect(mocks.registerDevicePushToken).toHaveBeenCalledWith(
      {},
      "device-1",
      EXPO_TOKEN,
      "android",
    );
    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("reports and rethrows when the OS will not issue a token", async () => {
    const failure = new Error("FIS_AUTH_ERROR");
    mocks.getExpoPushTokenAsync.mockRejectedValue(failure);
    const { syncDevicePushToken } = await import("./push-notifications");

    await expect(syncDevicePushToken()).rejects.toBe(failure);
    expect(mocks.reportError).toHaveBeenCalledWith(failure, {
      platform: "android",
      stage: "expo-push-token",
    });
    expect(mocks.registerDevicePushToken).not.toHaveBeenCalled();
  });

  it("reports and rethrows when the server rejects the registration", async () => {
    const failure = { message: "permission denied" };
    mocks.getExpoPushTokenAsync.mockResolvedValue({ data: EXPO_TOKEN });
    mocks.registerDevicePushToken.mockRejectedValue(failure);
    const { syncDevicePushToken } = await import("./push-notifications");

    await expect(syncDevicePushToken()).rejects.toBe(failure);
    expect(mocks.reportError).toHaveBeenCalledWith(failure, {
      platform: "android",
      stage: "register-device-push-token",
    });
  });

  it("never puts the token or device id in the report", async () => {
    mocks.getExpoPushTokenAsync.mockResolvedValue({ data: EXPO_TOKEN });
    mocks.registerDevicePushToken.mockRejectedValue(new Error("boom"));
    const { syncDevicePushToken } = await import("./push-notifications");

    await syncDevicePushToken().catch(() => undefined);

    const context = JSON.stringify(mocks.reportError.mock.calls[0]?.[1]);
    expect(context).not.toContain(EXPO_TOKEN);
    expect(context).not.toContain("device-1");
  });
});

describe("pausing push on this phone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deviceValues.clear();
    mocks.getExpoPushTokenAsync.mockResolvedValue({ data: EXPO_TOKEN });
    mocks.registerDevicePushToken.mockResolvedValue("row-id");
  });

  it("removes the phone's token from the server", async () => {
    const { pauseDevicePush } = await import("./push-notifications");

    await pauseDevicePush();

    expect(mocks.deactivateDevicePushToken).toHaveBeenCalledWith(
      {},
      "device-1",
    );
  });

  it("keeps the launch sync from registering again", async () => {
    const { pauseDevicePush, syncDevicePushToken } =
      await import("./push-notifications");
    await pauseDevicePush();

    await expect(syncDevicePushToken()).resolves.toBe("paused");
    expect(mocks.registerDevicePushToken).not.toHaveBeenCalled();
  });

  it("ends when the player turns push back on", async () => {
    const { pauseDevicePush, syncDevicePushToken, isDevicePushPaused } =
      await import("./push-notifications");
    await pauseDevicePush();

    await expect(
      syncDevicePushToken({ requestPermission: true }),
    ).resolves.toBe("registered");
    await expect(isDevicePushPaused()).resolves.toBe(false);
  });
});
