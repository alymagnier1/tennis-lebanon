/**
 * What JavaScript this app is actually running, for Settings.
 *
 * An EAS update downloads in the background and only runs after a full
 * restart, so "I opened it twice" does not prove a phone is on the update
 * that was published. The update ID and runtime shown here can be compared
 * with the EAS dashboard directly, and a tester can read them out when
 * reporting a bug. Kept free of `expo-updates` so it can be unit-tested; the
 * screen passes the module's values in.
 */

export type BuildSource =
  /** Running an update downloaded from EAS after install. */
  | "update"
  /** Running the bundle that shipped inside the APK. */
  | "embedded"
  /** expo-updates is off: a development build, Expo Go or the web. */
  | "disabled";

export type BuildInfo = {
  source: BuildSource;
  runtime: string | null;
  channel: string | null;
  /** The running update's ID, comparable with the EAS dashboard. */
  updateId: string | null;
};

export function describeBuildInfo(updates: {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  runtimeVersion: string | null;
  channel: string | null;
  updateId: string | null;
}): BuildInfo {
  if (!updates.isEnabled) {
    return { source: "disabled", runtime: null, channel: null, updateId: null };
  }
  return {
    source: updates.isEmbeddedLaunch ? "embedded" : "update",
    runtime: updates.runtimeVersion,
    channel: updates.channel,
    updateId: updates.updateId,
  };
}
