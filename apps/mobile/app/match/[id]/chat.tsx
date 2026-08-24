import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../../src/theme/create-live-sheet";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMatchHub } from "@tennis-lebanon/api";
import { MatchChatPanel } from "../../../src/components/MatchChatPanel";
import { AppText } from "../../../src/components/AppText";
import { ErrorNotice } from "../../../src/components/FormUi";
import { FigmaBackButton } from "../../../src/components/onboarding-ui";
import { useLayoutDirection } from "../../../src/lib/layout-direction";
import { stackScreenTopPadding } from "../../../src/lib/stack-screen-padding";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/providers/AuthProvider";
import { tennisColors, tennisSpacing } from "../../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../../src/hooks/useTennisFonts";
import { tennisTextStyles } from "../../../src/theme/tennis-text-styles";

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
          <ErrorNotice>{t("matches.hub.loadError")}</ErrorNotice>
        </View>
      ) : null}

      {hubQuery.isSuccess && !canChat ? (
        <View style={styles.notice}>
          <AppText style={styles.denied}>{t("matches.chat.denied")}</AppText>
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
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    notice: {
      paddingHorizontal: tennisSpacing.screenX,
      paddingTop: 16,
    },
    denied: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.mutedForeground,
    },
  }),
);
