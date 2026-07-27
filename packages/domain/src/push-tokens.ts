export type PushPlatform = "ios" | "android";

export function normalizePushPlatform(
  value: string | null | undefined,
): PushPlatform | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "ios" || normalized === "android") {
    return normalized;
  }
  return null;
}

export function isValidDeviceId(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed.length >= 1 && trimmed.length <= 128);
}

export function isValidExpoPushToken(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length < 10 || trimmed.length > 512) {
    return false;
  }

  return (
    trimmed.startsWith("ExponentPushToken[") ||
    trimmed.startsWith("ExpoPushToken[")
  );
}
