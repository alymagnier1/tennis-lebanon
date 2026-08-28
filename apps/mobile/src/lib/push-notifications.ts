import Constants from "expo-constants";
import * as Device from "expo-device";
import type { NotificationPermissionsStatus } from "expo-notifications";
import { Linking, Platform } from "react-native";
import {
  deactivateDevicePushToken,
  registerDevicePushToken,
} from "@tennis-lebanon/api";
import {
  isValidExpoPushToken,
  normalizePushPlatform,
  type PushPlatform,
} from "@tennis-lebanon/domain";
import { getStableDeviceId } from "./device-id";
import { getNativeNotifications } from "./native-notifications";
import { reportError } from "./sentry";
import { supabase } from "./supabase";

export type PushRegistrationResult =
  | "registered"
  | "denied"
  /** No Expo project id in the build; push cannot work at all. */
  | "unconfigured"
  /** Simulator, web, or a device that returned no token. */
  | "unavailable"
  | "skipped";

export type PushPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  /** Web or simulator: the OS will never issue a push token here. */
  | "unsupported";

export type PushPermissionState = {
  status: PushPermissionStatus;
  /**
   * False once the OS has stopped showing the prompt. The only way back on is
   * the system settings app, so the UI has to say so rather than offer a
   * button that silently does nothing.
   */
  canAskAgain: boolean;
};

const nativeNotifications = getNativeNotifications();

if (nativeNotifications) {
  nativeNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function getPushPlatform(): PushPlatform | null {
  return normalizePushPlatform(Platform.OS);
}

function supportsPush(): boolean {
  return (
    Platform.OS !== "web" && Device.isDevice && nativeNotifications !== null
  );
}

function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

/**
 * A build with no Expo project id can never obtain a push token, so every
 * notification enqueued for its users is parked as `no_delivery_channel`. That
 * used to be a bare `return null` — no throw, no log, nothing anywhere. Report
 * it once per session so a misconfigured build is visible instead of merely
 * quiet.
 */
let reportedMissingProjectId = false;

function reportMissingProjectId(): void {
  if (reportedMissingProjectId) {
    return;
  }
  reportedMissingProjectId = true;
  void reportError(
    new Error("Expo project id missing; push notifications cannot register"),
    { platform: Platform.OS },
  );
}

/** True for a full grant and for iOS provisional (quiet) authorization. */
function isGranted(permissions: NotificationPermissionsStatus): boolean {
  if (!nativeNotifications) {
    return false;
  }

  return (
    permissions.granted ||
    permissions.ios?.status ===
      nativeNotifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!supportsPush() || !nativeNotifications) {
    return { status: "unsupported", canAskAgain: false };
  }

  const current = await nativeNotifications.getPermissionsAsync();
  if (isGranted(current)) {
    return { status: "granted", canAskAgain: false };
  }

  return {
    status: current.canAskAgain ? "undetermined" : "denied",
    canAskAgain: current.canAskAgain,
  };
}

export async function requestPushPermission(): Promise<boolean> {
  if (!supportsPush() || !nativeNotifications) {
    return false;
  }

  const current = await nativeNotifications.getPermissionsAsync();
  if (isGranted(current)) {
    return true;
  }

  const requested = await nativeNotifications.requestPermissionsAsync();
  return isGranted(requested);
}

export async function getExpoPushTokenValue(): Promise<string | null> {
  if (!supportsPush() || !nativeNotifications) {
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    reportMissingProjectId();
    return null;
  }

  const token = await nativeNotifications.getExpoPushTokenAsync({ projectId });
  const value = token.data?.trim();
  return isValidExpoPushToken(value) ? value : null;
}

export async function syncDevicePushToken(options?: {
  requestPermission?: boolean;
}): Promise<PushRegistrationResult> {
  const platform = getPushPlatform();
  if (!platform) {
    return "unavailable";
  }

  if (options?.requestPermission) {
    const granted = await requestPushPermission();
    if (!granted) {
      return "denied";
    }
  } else {
    const current = await getPushPermissionState();
    if (current.status !== "granted") {
      return "skipped";
    }
  }

  // Checked after permission so the caller can tell "the user said no" apart
  // from "this build was never wired up".
  if (!getExpoProjectId()) {
    reportMissingProjectId();
    return "unconfigured";
  }

  const token = await getExpoPushTokenValue();
  if (!token) {
    return "unavailable";
  }

  const deviceId = await getStableDeviceId();
  await registerDevicePushToken(supabase, deviceId, token, platform);
  return "registered";
}

export async function unregisterDevicePushToken(): Promise<void> {
  const platform = getPushPlatform();
  if (!platform) {
    return;
  }

  const deviceId = await getStableDeviceId();
  await deactivateDevicePushToken(supabase, deviceId);
}

/**
 * Opens this app's page in the system settings app. The only route back for
 * someone who has already declined the OS prompt.
 */
export async function openSystemNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}
