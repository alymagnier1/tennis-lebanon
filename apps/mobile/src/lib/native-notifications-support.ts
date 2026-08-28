/**
 * SDK 53+ Expo Go on Android throws if `expo-notifications` is imported at all.
 * Remote push only works in a development or production build.
 *
 * Kept free of react-native so the rule is unit-testable.
 *
 * @see https://docs.expo.dev/develop/development-builds/introduction/
 */
export function isNativeNotificationsSupported(input: {
  os: string;
  executionEnvironment?: string | null;
  appOwnership?: string | null;
}): boolean {
  if (input.os === "web") {
    return false;
  }

  const isExpoGo =
    input.executionEnvironment === "storeClient" ||
    input.appOwnership === "expo";

  return !(input.os === "android" && isExpoGo);
}
