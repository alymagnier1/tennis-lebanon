import { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUserNotifications,
  markNotificationRead,
  type UserNotificationRow,
  markAllNotificationsRead,
} from "@tennis-lebanon/api";
import { AppText } from "../src/components/AppText";
import { Icon } from "../src/components/Icon";
import { ListSkeleton } from "../src/components/AppUi";
import { Screen, ScreenError } from "../src/components/FormUi";
import { formatUtcInBeirut } from "../src/lib/beirut-time";
import { resolveNotificationCopy } from "../src/lib/notification-copy";
import { resolveNotificationHref } from "../src/lib/notification-deep-link";
import { supabase } from "../src/lib/supabase";
import { tennisColors, tennisRadii } from "../src/theme/tennis-tokens";
import { tennisFontFamily } from "../src/hooks/useTennisFonts";

function notificationIcon(
  kind: string,
): "notifications" | "calendar" | "place" | "info" {
  if (kind.includes("invite")) return "notifications";
  if (kind.includes("vote") || kind.includes("time")) return "calendar";
  if (kind.includes("booking") || kind.includes("court")) return "place";
  return "info";
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
      await queryClient.invalidateQueries({
        queryKey: ["user-notifications-unread"],
      });
    },
  });

  const markAllRead = useCallback(async () => {
    // One statement server side rather than a loop over the loaded page: the
    // page is 20 rows, and anything unread below it would survive the loop and
    // keep the bell lit.
    await markAllNotificationsRead(supabase);
    await queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
    await queryClient.invalidateQueries({
      queryKey: ["user-notifications-unread"],
    });
  }, [notificationsQuery.data, queryClient]);

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

  const rows = notificationsQuery.data ?? [];
  const hasUnread = rows.some((row) => !row.read_at);

  return (
    <Screen
      title={t("notifications.centerTitle")}
      description={t("notifications.centerDescription")}
      refreshing={notificationsQuery.isRefetching}
      onRefresh={() => void notificationsQuery.refetch()}
      fixedHeader={
        hasUnread ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void markAllRead()}
            style={styles.markAll}
          >
            <AppText style={styles.markAllLabel}>
              {t("notifications.markAllRead")}
            </AppText>
          </Pressable>
        ) : null
      }
    >
      {notificationsQuery.isLoading ? <ListSkeleton rows={5} /> : null}

      {notificationsQuery.isError ? (
        <ScreenError
          message={t("notifications.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void notificationsQuery.refetch()}
        />
      ) : null}

      {!notificationsQuery.isLoading &&
      !notificationsQuery.isError &&
      rows.length === 0 ? (
        <AppText style={styles.empty}>{t("notifications.empty")}</AppText>
      ) : null}

      <View style={styles.list}>
        {rows.map((row) => {
          const copy = resolveNotificationCopy(
            { kind: row.kind, payload: row.payload },
            t,
          );
          const timestamp = formatUtcInBeirut(row.sent_at ?? row.created_at);
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
              <View style={styles.iconWrap}>
                <Icon
                  name={notificationIcon(row.kind)}
                  size={18}
                  color={tennisColors.primary}
                />
              </View>
              <View style={styles.rowContent}>
                <AppText style={styles.rowTitle}>{copy.title}</AppText>
                <AppText style={styles.rowBody}>{copy.body}</AppText>
                <AppText style={styles.rowTime}>{timestamp}</AppText>
              </View>
              {!row.read_at ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
    marginBottom: 8,
  },
  markAllLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primary,
  },
  list: {
    gap: 10,
  },
  row: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.lg,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  rowUnread: {
    borderColor: tennisColors.primary,
    backgroundColor: tennisColors.secondary,
  },
  rowPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tennisColors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
  rowBody: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
    lineHeight: 18,
  },
  rowTime: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    color: tennisColors.mutedForeground,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tennisColors.lime,
    marginTop: 6,
  },
  empty: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
    textAlign: "center",
    paddingVertical: 24,
  },
});
