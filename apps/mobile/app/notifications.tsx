import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../src/theme/create-live-sheet";
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
import { EmptyState, ListSkeleton } from "../src/components/AppUi";
import { Screen, ScreenError } from "../src/components/FormUi";
import { NotificationCard } from "../src/components/notifications/NotificationCard";
import { formatUtcTimeInBeirut } from "../src/lib/beirut-time";
import { useLayoutDirection } from "../src/lib/layout-direction";
import { resolveNotificationCopy } from "../src/lib/notification-copy";
import { resolveNotificationHref } from "../src/lib/notification-deep-link";
import {
  groupNotificationsByDay,
  notificationLook,
  type NotificationDayLabel,
} from "../src/lib/notification-list";
import { supabase } from "../src/lib/supabase";
import { tennisColors } from "../src/theme/tennis-tokens";
import { tennisFontFamily } from "../src/hooks/useTennisFonts";

/** A day key read at noon UTC, so no time zone can move it to another day. */
function dayKeyDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { rowDirection, writingDirection } = useLayoutDirection();
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
  }, [queryClient]);

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

  const rows = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data],
  );
  const unreadCount = rows.filter((row) => !row.read_at).length;
  const groups = useMemo(
    () => groupNotificationsByDay(rows, new Date().toISOString()),
    [rows],
  );

  const dayHeading = (label: NotificationDayLabel): string => {
    switch (label.kind) {
      case "today":
        return t("notifications.today");
      case "yesterday":
        return t("notifications.yesterday");
      case "weekday":
        return new Intl.DateTimeFormat(locale, {
          weekday: "long",
          timeZone: "UTC",
        }).format(dayKeyDate(label.dateKey));
      case "date":
        return new Intl.DateTimeFormat(locale, {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(dayKeyDate(label.dateKey));
    }
  };

  const showEmpty =
    !notificationsQuery.isLoading &&
    !notificationsQuery.isError &&
    rows.length === 0;

  return (
    <Screen
      onBack={() => router.back()}
      title={t("notifications.centerTitle")}
      refreshing={notificationsQuery.isRefetching}
      onRefresh={() => void notificationsQuery.refetch()}
      fixedHeader={
        unreadCount > 0 ? (
          <View style={[styles.unreadBar, { flexDirection: rowDirection }]}>
            <AppText style={[styles.unreadCount, { writingDirection }]}>
              {t("notifications.unreadCount", { count: unreadCount })}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void markAllRead()}
              hitSlop={8}
              style={({ pressed }) => [
                styles.markAll,
                pressed && styles.markAllPressed,
              ]}
            >
              <AppText style={styles.markAllLabel}>
                {t("notifications.markAllRead")}
              </AppText>
            </Pressable>
          </View>
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

      {showEmpty ? (
        <EmptyState
          icon="notifications"
          title={t("notifications.empty")}
          body={t("notifications.emptyBody")}
        />
      ) : null}

      <View style={styles.days}>
        {groups.map((group) => (
          <View key={group.dateKey} style={styles.day}>
            <AppText
              accessibilityRole="header"
              style={[styles.dayHeading, { writingDirection }]}
            >
              {dayHeading(group.label)}
            </AppText>
            <View style={styles.cards}>
              {group.rows.map((row) => {
                const copy = resolveNotificationCopy(
                  { kind: row.kind, payload: row.payload },
                  t,
                );
                return (
                  <NotificationCard
                    key={row.id}
                    title={copy.title}
                    body={copy.body}
                    time={formatUtcTimeInBeirut(row.scheduled_at)}
                    unread={!row.read_at}
                    look={notificationLook(row.kind)}
                    onPress={() => void openNotification(row)}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    unreadBar: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 8,
    },
    unreadCount: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    markAll: {
      minHeight: 36,
      justifyContent: "center",
    },
    markAllPressed: {
      opacity: 0.7,
    },
    markAllLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      color: tennisColors.linkText,
    },
    days: {
      gap: 22,
    },
    day: {
      gap: 10,
    },
    dayHeading: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      letterSpacing: 0.2,
      color: tennisColors.mutedForeground,
    },
    cards: {
      gap: 8,
    },
  }),
);
