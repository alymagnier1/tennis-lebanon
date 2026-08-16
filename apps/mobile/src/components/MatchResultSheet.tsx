import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getMatchHub } from "@tennis-lebanon/api";
import { BottomSheet } from "./AppUi";
import { AppText } from "./AppText";
import { MatchResultPanel } from "./MatchResultPanel";
import { useAuth } from "../providers/AuthProvider";
import { supabase } from "../lib/supabase";
import { tennisColors } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

/**
 * List shortcut for "Confirm you played" — same attendance + score flow as the
 * hub Result section, without navigating away from Matches.
 */
export function MatchResultSheet({
  matchId,
  visible,
  onClose,
}: {
  matchId: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const viewerUserId = session?.user.id ?? "";

  const hubQuery = useQuery({
    queryKey: ["match-hub", matchId],
    queryFn: () => getMatchHub(supabase, matchId!),
    enabled: visible && Boolean(matchId),
  });

  return (
    <BottomSheet
      visible={visible && Boolean(matchId)}
      title={t("matches.results.title")}
      onClose={onClose}
    >
      {!viewerUserId || hubQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={tennisColors.primary} />
        </View>
      ) : null}

      {hubQuery.isError ? (
        <View style={styles.stack}>
          <AppText style={styles.error}>{t("matches.list.loadError")}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.retry")}
            onPress={() => void hubQuery.refetch()}
          >
            <AppText style={styles.retry}>{t("common.retry")}</AppText>
          </Pressable>
        </View>
      ) : null}

      {hubQuery.data && viewerUserId && matchId ? (
        <MatchResultPanel
          matchId={matchId}
          hub={hubQuery.data}
          viewerUserId={viewerUserId}
          presentation="plain"
          onComplete={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  centered: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    gap: 12,
  },
  error: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
    lineHeight: 20,
  },
  retry: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 14,
    color: tennisColors.primary,
  },
});
