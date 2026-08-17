import {
  deviceStorageKey,
  readDeviceValue,
  writeDeviceValue,
} from "./device-storage";

/**
 * Remembers that this account has already seen the contextual push ask on this
 * device. Split from `push-nudge.ts` so the decision stays free of react-native
 * and therefore unit-testable.
 */

const NUDGE_SCOPE = "push-nudge-seen";

export async function hasSeenPushNudge(userId: string): Promise<boolean> {
  const raw = await readDeviceValue(deviceStorageKey(NUDGE_SCOPE, userId));
  return raw === "1";
}

export async function markPushNudgeSeen(userId: string): Promise<void> {
  await writeDeviceValue(deviceStorageKey(NUDGE_SCOPE, userId), "1");
}
