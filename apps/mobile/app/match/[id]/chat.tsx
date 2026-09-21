import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../../src/theme/create-live-sheet";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMatchHub } from "@tennis-lebanon/api";
import { MatchChatPanel } from "../../../src/components/MatchChatPanel";
import { AppText } from "../../../src/components/AppText";
import { EmptyState } from "../../../src/components/AppUi";
import { ScreenError } from "../../../src/components/FormUi";
import {
  FigmaBackButton,
  FigmaSecondaryButton,
} from "../../../src/components/onboarding-ui";
import { formatCompactUtcInBeirut } from "../../../src/lib/beirut-time";
import { resolveHubHeroStartsAt } from "../../../src/lib/hub-agreed-time";
import { matchChatHeaderSubtitle } from "../../../src/lib/match-chat-header";
import { useLayoutDirection } from "../../../src/lib/layout-direction";
import { stackScreenTopPadding } from "../../../src/lib/stack-screen-padding";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/providers/AuthProvider";
import { tennisColors, tennisSpacing } from "../../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../../src/hooks/useTennisFonts";
import { tennisTextStyles } from "../../../src/theme/tennis-text-styles";

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
};

export default function MatchChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();
  const topPadding = stackScreenTopPadding(insets.top);

  const hubQuery = useQuery({
    queryKey: ["match-hub", id],
    queryFn: () => getMatchHub(supabase, id!),
    enabled: Boolean(id),
  });

  const canChat = hubQuery.data?.viewer_status === "accepted";

  const subtitle = useMemo(() => {
    const hub = hubQuery.data;
    if (!hub) return null;
    const participants =
      (hub.participants as HubParticipant[] | undefined) ?? [];
    const startsAt = resolveHubHeroStartsAt(
      hub,
      hub.proposed_times ?? [],
      hub.booking?.starts_at,
    );
    return matchChatHeaderSubtitle({
      participants,
      viewerUserId: session?.user.id,
      startsAt,
      formatStartsAt: formatCompactUtcInBeirut,
    });
  }, [hubQuery.data, session?.user.id]);

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          { paddingTop: topPadding, paddingHorizontal: tennisSpacing.screenX },
        ]}
      >
        <FigmaBackButton onPress={() => router.back()} />
        <View style={tennisTextStyles.titleSubtitleBlock}>
          <AppText
            accessibilityRole="header"
            style={[styles.title, { writingDirection }]}
            maxLines={2}
          >
            {t("matches.chat.title")}
          </AppText>
          {subtitle ? (
            <AppText
              style={[styles.subtitle, { writingDirection }]}
              maxLines={2}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>

      {hubQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator
            color={tennisColors.primary}
            accessibilityLabel={t("common.loading")}
          />
        </View>
      ) : null}

      {hubQuery.isError ? (
        <View style={styles.notice}>
          <ScreenError
            message={t("matches.hub.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void hubQuery.refetch()}
          />
        </View>
      ) : null}

      {hubQuery.isSuccess && !canChat ? (
        <View style={styles.denied}>
          <EmptyState
            icon="chat"
            title={t("matches.chat.denied")}
            body={t("matches.chat.deniedHint")}
            action={
              <FigmaSecondaryButton
                label={t("common.back")}
                onPress={() => router.back()}
              />
            }
          />
        </View>
      ) : null}

      {id && canChat ? (
        <MatchChatPanel matchId={id} enabled viewerUserId={session?.user.id} />
      ) : null}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    header: {
      gap: 12,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tennisColors.border,
    },
    title: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 24,
      lineHeight: 30,
      color: tennisColors.primaryDark,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    notice: {
      flex: 1,
      paddingHorizontal: tennisSpacing.screenX,
      paddingTop: 16,
    },
    denied: {
      flex: 1,
      paddingHorizontal: tennisSpacing.screenX,
      paddingTop: 24,
    },
  }),
);
