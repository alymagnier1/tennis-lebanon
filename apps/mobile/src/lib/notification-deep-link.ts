import type { Href } from "expo-router";
import {
  normalizeNotificationDeepLink,
  parseNotificationPayload,
} from "@tennis-lebanon/domain";

export function resolveNotificationHref(
  data: Record<string, unknown> | undefined,
): Href | null {
  const payload = parseNotificationPayload(data);
  const deepLink = normalizeNotificationDeepLink(payload?.deepLink);
  if (!deepLink) {
    return null;
  }

  if (deepLink.startsWith("/match/")) {
    const matchId = deepLink.replace("/match/", "").split("/")[0];
    if (!matchId) {
      return null;
    }
    return {
      pathname: "/match/[id]",
      params: { id: matchId },
    } as Href;
  }

  if (deepLink === "/matches" || deepLink.startsWith("/(tabs)/matches")) {
    return "/(tabs)/matches" as Href;
  }

  return deepLink as Href;
}
