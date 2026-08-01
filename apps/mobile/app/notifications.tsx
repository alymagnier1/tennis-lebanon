import { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUserNotifications,
  markNotificationRead,
  type UserNotificationRow,
} from "@tennis-lebanon/api";
import { isNotificationKind } from "@tennis-lebanon/domain";
import { AppText } from "../src/components/AppText";
import { Screen } from "../src/components/FormUi";
import { resolveNotificationHref } from "../src/lib/notification-deep-link";
import { supabase } from "../src/lib/supabase";
import { tennisColors, tennisRadii } from "../src/theme/tennis-tokens";
import { tennisFontFamily } from "../src/hooks/useTennisFonts";

function notificationCopy(
  row: UserNotificationRow,
  t: (key: string) => string,
): { title: string; body: string } {
  const payload = row.payload ?? {};
  const title =
    typeof payload.title === "string"
      ? payload.title
      : isNotificationKind(row.kind)
        ? t(`notifications.kinds.${row.kind}.title`)
        : t("notifications.fallbackTitle");
  const body =
    typeof payload.body === "string"
      ? payload.body
      : isNotificationKind(row.kind)
        ? t(`notifications.kinds.${row.kind}.body`)
        : t("notifications.fallbackBody");

  return { title, body };
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["user-notifications"],
    queryFn: () => listUserNotifications(supabase),
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(supabase, notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
    },
  });

  const openNotification = useCallback(
    async (row: UserNotificationRow) => {
      if (!row.read_at) {
        await markReadMutation.mutateAsync(row.id);
      }

      const href = resolveNotificationHref(row.payload);
      if (href) {
        router.push(href);
      }
    },
    [markReadMutation],
  );

  return (
    <Screen
      title={t("notifications.centerTitle")}
      description={t("notifications.centerDescription")}
      refreshing={notificationsQuery.isRefetching}
      onRefresh={() => void notificationsQuery.refetch()}
    >
      {notificationsQuery.isLoading ? (
        <ActivityIndicator color={tennisColors.primary} />
      ) : null}

      {notificationsQuery.isError ? (
        <AppText style={styles.error}>{t("notifications.loadError")}</AppText>
      ) : (notificationsQuery.data ?? []).length === 0 &&
        !notificationsQuery.isLoading ? (
        <AppText style={styles.empty}>{t("notifications.empty")}</AppText>
      ) : null}

      <View style={styles.list}>
        {(notificationsQuery.data ?? []).map((row) => {
          const copy = notificationCopy(row, t);
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => void openNotification(row)}
              style={({ pressed }) => [
                styles.row,
                !row.read_at && styles.rowUnread,
                pressed && styles.rowPressed,
              ]}
            >
              <AppText style={styles.rowTitle}>{copy.title}</AppText>
              <AppText style={styles.rowBody}>{copy.body}</AppText>
              {!row.read_at ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.lg,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 14,
    gap: 4,
  },
  rowUnread: {
    borderColor: tennisColors.primary,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowTitle: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
  rowBody: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
  },
  unreadDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tennisColors.accent,
  },
  empty: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
  },
  error: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.danger,
  },
});
