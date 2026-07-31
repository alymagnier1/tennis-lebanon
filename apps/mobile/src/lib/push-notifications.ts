import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
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
import { supabase } from "./supabase";

export type PushRegistrationResult =
  "registered" | "denied" | "unavailable" | "skipped";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function getPushPlatform(): PushPlatform | null {
  return normalizePushPlatform(Platform.OS);
}

function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === "web" || !Device.isDevice) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function getExpoPushTokenValue(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) {
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
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
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted) {
      return "skipped";
    }
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
