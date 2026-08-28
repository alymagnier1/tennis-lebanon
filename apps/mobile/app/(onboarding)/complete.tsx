import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { OpenMatchCard } from "@tennis-lebanon/api";
import { AppText } from "../../src/components/AppText";
import { Icon } from "../../src/components/Icon";
import {
  CourtGridOverlay,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../src/components/onboarding-ui";
import { useAuth } from "../../src/providers/AuthProvider";
import { useHomeOpenMatchPicks } from "../../src/hooks/useHomeOpenMatchPicks";
import { completeGiftState } from "../../src/lib/complete-gift-state";
import { startNewMatchCreate } from "../../src/lib/create-match-guard";
import { isLastOpenMatchSpot } from "../../src/lib/open-match-scarcity";
import { openMatchCardDateTimeLabel } from "../../src/lib/open-match-card-time";
import { matchHubRoute } from "../../src/lib/routes";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../src/theme/tennis-tokens";
import { useLayoutDirection } from "../../src/lib/layout-direction";

function GiftMatchRow({ match }: { match: OpenMatchCard }) {
  const { t } = useTranslation();
  const { rowDirection } = useLayoutDirection();
  const when = openMatchCardDateTimeLabel(match);
  const lastSpot = isLastOpenMatchSpot(match.participant_count, match.capacity);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${match.creator_display_name}${when ? `, ${when}` : ""}`}
      onPress={() => router.push(matchHubRoute(match.match_id))}
      style={({ pressed }) => [
        styles.giftRow,
        { flexDirection: rowDirection },
        pressed && styles.giftRowPressed,
      ]}
    >
      <View style={styles.giftCopy}>
        <AppText style={styles.giftHost} maxLines={1}>
          {match.creator_display_name}
        </AppText>
        {when ? (
          <AppText style={styles.giftMeta} maxLines={1}>
            {when}
          </AppText>
        ) : null}
        {lastSpot ? (
          <AppText style={styles.giftScarce}>
            {t("discover.spotsRemaining", { count: 1 })}
          </AppText>
        ) : null}
      </View>
      <AppText style={styles.giftOpen}>
        {t("onboarding.complete.giftOpenCta")}
      </AppText>
    </Pressable>
  );
}

export default function OnboardingCompleteScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const name = profile?.display_name?.split(" ")[0] ?? "";
  const { matches, matchesQuery, clubsQuery } = useHomeOpenMatchPicks();
  const gift = completeGiftState({
    isPending: matchesQuery.isPending || clubsQuery.isPending,
    isError: matchesQuery.isError || clubsQuery.isError,
    matches,
  });

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <CourtGridOverlay />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.icon}>
          <Icon name="court" size={44} color={tennisColors.primary} />
        </View>
        <AppText style={styles.title}>{t("onboarding.complete.title")}</AppText>
        <AppText style={styles.titleAccent}>
          {t("onboarding.complete.titleAccent", { name })}
        </AppText>
        <AppText style={styles.description}>
          {t("onboarding.complete.description")}
        </AppText>

        {gift.kind === "listings" ? (
          <View style={styles.giftBlock}>
            <AppText style={styles.giftTitle}>
              {t("onboarding.complete.giftTitle")}
            </AppText>
            {gift.matches.map((match) => (
              <GiftMatchRow key={match.match_id} match={match} />
            ))}
          </View>
        ) : null}

        {gift.kind === "empty" ? (
          <View style={styles.giftBlock}>
            <AppText style={styles.giftTitle}>
              {t("onboarding.complete.giftEmptyTitle")}
            </AppText>
            <AppText style={styles.giftEmptyBody}>
              {t("onboarding.complete.giftEmptyBody")}
            </AppText>
            <FigmaSecondaryButton
              label={t("home.openMatches.organise")}
              ghostOnDark
              onPress={() => startNewMatchCreate()}
            />
          </View>
        ) : null}

        {gift.kind === "error" ? (
          <View style={styles.giftBlock}>
            <AppText style={styles.giftEmptyBody}>
              {t("onboarding.complete.giftErrorBody")}
            </AppText>
            <FigmaSecondaryButton
              label={t("common.retry")}
              ghostOnDark
              onPress={() => {
                void matchesQuery.refetch();
                void clubsQuery.refetch();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
      <FigmaPrimaryButton
        label={t("onboarding.complete.cta")}
        lime
        onPress={() => router.replace("/(tabs)")}
        style={styles.cta}
      />
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tennisColors.primary,
      paddingHorizontal: 32,
      overflow: "hidden",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 16,
    },
    icon: {
      width: 96,
      height: 96,
      borderRadius: 28,
      backgroundColor: tennisColors.lime,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    title: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 36,
      color: tennisColors.white,
      textAlign: "center",
      letterSpacing: -1,
    },
    titleAccent: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 36,
      color: tennisColors.lime,
      textAlign: "center",
      letterSpacing: -1,
      marginBottom: 12,
    },
    description: {
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      lineHeight: 24,
      color: "rgba(255,255,255,0.65)",
      textAlign: "center",
      marginBottom: 20,
      maxWidth: 300,
    },
    giftBlock: {
      width: "100%",
      gap: 10,
      marginBottom: 8,
    },
    giftTitle: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 16,
      color: tennisColors.white,
      textAlign: "center",
    },
    giftEmptyBody: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: "rgba(255,255,255,0.65)",
      textAlign: "center",
      marginBottom: 4,
    },
    giftRow: {
      width: "100%",
      minHeight: 44,
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: tennisRadii.lg,
      backgroundColor: tennisColors.heroOverlay,
      borderWidth: 1,
      borderColor: tennisColors.heroBorder,
    },
    giftRowPressed: {
      opacity: 0.8,
    },
    giftCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    giftHost: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 16,
      color: tennisColors.white,
    },
    giftMeta: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: "rgba(255,255,255,0.65)",
    },
    giftScarce: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      color: tennisColors.lime,
    },
    giftOpen: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
      color: tennisColors.lime,
    },
    cta: {
      marginTop: 16,
    },
  }),
);
