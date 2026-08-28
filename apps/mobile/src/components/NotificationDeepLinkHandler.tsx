import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { NotificationResponse } from "expo-notifications";
import { router } from "expo-router";
import { useAuth } from "../providers/AuthProvider";
import { getNativeNotifications } from "../lib/native-notifications";
import { resolveNotificationHref } from "../lib/notification-deep-link";

function navigateFromNotificationData(
  data: Record<string, unknown> | undefined,
): void {
  const href = resolveNotificationHref(data);
  if (href) {
    router.push(href);
  }
}

export function NotificationDeepLinkHandler() {
  const { state } = useAuth();
  const handledInitialRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web" || state !== "ready") {
      return;
    }

    const Notifications = getNativeNotifications();
    if (!Notifications) {
      return;
    }

    const handleResponse = (response: NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      navigateFromNotificationData(
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : undefined,
      );
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);

    if (!handledInitialRef.current) {
      handledInitialRef.current = true;
      void Notifications.getLastNotificationResponseAsync().then(
        handleResponse,
      );
    }

    return () => subscription.remove();
  }, [state]);

  return null;
}
