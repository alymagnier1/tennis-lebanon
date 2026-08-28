import Constants from "expo-constants";
import { Platform } from "react-native";
import { isNativeNotificationsSupported } from "./native-notifications-support";

type NativeNotificationsModule = typeof import("expo-notifications");

export { isNativeNotificationsSupported };

export function canUseNativeNotifications(): boolean {
  return isNativeNotificationsSupported({
    os: Platform.OS,
    executionEnvironment: Constants.executionEnvironment,
    appOwnership: Constants.appOwnership,
  });
}

let cached: NativeNotificationsModule | null | undefined;

/**
 * Lazily loads the native module. A static import crashes Android Expo Go
 * before any of the push helpers can decide they are unsupported.
 */
export function getNativeNotifications(): NativeNotificationsModule | null {
  if (!canUseNativeNotifications()) {
    return null;
  }

  if (cached === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not evaluate in Android Expo Go
    cached = require("expo-notifications") as NativeNotificationsModule;
  }

  return cached;
}
