import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { OpenMatchCard } from "@tennis-lebanon/api";
import { AppText } from "../../src/components/AppText";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../src/components/onboarding-ui";
import { HeroScrim } from "../../src/components/onboarding-ui/HeroScrim";
import { useAuth } from "../../src/providers/AuthProvider";
import { useHeroVariant } from "../../src/providers/HeroVariantProvider";
import { useHomeOpenMatchPicks } from "../../src/hooks/useHomeOpenMatchPicks";
import { completeGiftState } from "../../src/lib/complete-gift-state";
import { startNewMatchCreate } from "../../src/lib/create-match-guard";
import { isLastOpenMatchSpot } from "../../src/lib/open-match-scarcity";
import { openMatchCardDateTimeLabel } from "../../src/lib/open-match-card-time";
import { matchHubRoute } from "../../src/lib/routes";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import {
  tennisColors,
  tennisRadii,
  tennisSpacing,
} from "../../src/theme/tennis-tokens";
import { tennisTextStyles } from "../../src/theme/tennis-text-styles";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import type { HeroFamily } from "../../src/theme/hero-variant";

const ART = {
  court: require("../../assets/onboarding/hero-court.png"),
  racket: require("../../assets/onboarding/hero-racket-cream.png"),
} as const;

type DoneField = {
  ground: string;
  art: number;
  artStyle: object;
  statusBar: "light" | "dark";
  bottomScrim: {
    height: number;
    colors: [string, string, ...string[]];
    locations: [number, number, ...number[]];
  };
  pillFill: string;
  pillText: string;
  title: string;
  accent: string;
  display: "display" | "tall";
  description: string;
  giftSurface: "dark" | "light";
  cta: "lime" | "hero";
  secondaryGhost: "dark" | "light";
};

function doneFields(): Record<HeroFamily, DoneField> {
  return {
    green: {
      ground: tennisColors.heroGreenDeep,
      art: ART.court,
      artStyle: { opacity: 0.55 },
      statusBar: "light",
      bottomScrim: {
        height: 420,
        colors: [
          "rgba(10,45,38,0)",
          "rgba(10,45,38,0.78)",
          "rgba(10,42,34,0.95)",
          "rgba(10,40,32,0.98)",
        ],
        locations: [0, 0.3, 0.64, 1],
      },
      pillFill: tennisColors.lime,
      pillText: tennisColors.limeText,
      title: tennisColors.white,
      accent: tennisColors.lime,
      display: "display",
      description: "rgba(255,255,255,0.72)",
      giftSurface: "dark",
      cta: "lime",
      secondaryGhost: "dark",
    },
    light: {
      ground: tennisColors.heroClay,
      art: ART.racket,
      artStyle: { top: 0, bottom: 300, left: 0, right: 0 },
      statusBar: "dark",
      bottomScrim: {
        height: 340,
        colors: [
          "rgba(232,220,194,0)",
          "rgba(232,220,194,0.92)",
          tennisColors.heroClay,
        ],
        locations: [0, 0.38, 1],
      },
      pillFill: tennisColors.heroGreen,
      pillText: tennisColors.onPrimary,
      title: tennisColors.heroOnLight,
      accent: tennisColors.heroGreen,
      display: "tall",
      description: "rgba(13,28,20,0.7)",
      giftSurface: "light",
      cta: "hero",
      secondaryGhost: "light",
    },
  };
}

function GiftMatchRow({
  match,
  surface,
}: {
  match: OpenMatchCard;
  surface: "dark" | "light";
}) {
  const { t } = useTranslation();
  const { rowDirection } = useLayoutDirection();
  const when = openMatchCardDateTimeLabel(match);
  const lastSpot = isLastOpenMatchSpot(match.participant_count, match.capacity);
  const light = surface === "light";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${match.creator_display_name}${when ? `, ${when}` : ""}`}
      onPress={() => router.push(matchHubRoute(match.match_id))}
      style={({ pressed }) => [
        styles.giftRow,
        { flexDirection: rowDirection },
        light ? styles.giftRowLight : styles.giftRowDark,
        pressed && styles.giftRowPressed,
      ]}
    >
      <View style={styles.giftCopy}>
        <AppText
          style={[styles.giftHost, light ? styles.inkDark : styles.inkLight]}
          maxLines={1}
        >
          {match.creator_display_name}
        </AppText>
        {when ? (
          <AppText
            style={[
              styles.giftMeta,
              light ? styles.metaLight : styles.metaDark,
            ]}
            maxLines={1}
          >
            {when}
          </AppText>
        ) : null}
        {lastSpot ? (
          <AppText
            style={[
              styles.giftScarce,
              light ? styles.accentGreen : styles.accentLime,
            ]}
          >
            {t("discover.spotsRemaining", { count: 1 })}
          </AppText>
        ) : null}
      </View>
      <AppText
        style={[
          styles.giftOpen,
          light ? styles.accentGreen : styles.accentLime,
        ]}
      >
        {t("onboarding.complete.giftOpenCta")}
      </AppText>
    </Pressable>
  );
}

export default function OnboardingCompleteScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { family } = useHeroVariant();
  const field = doneFields()[family];
  const name = profile?.display_name?.split(" ")[0] ?? "";
  const { matches, matchesQuery, clubsQuery } = useHomeOpenMatchPicks();
  const gift = completeGiftState({
    isPending: matchesQuery.isPending || clubsQuery.isPending,
    isError: matchesQuery.isError || clubsQuery.isError,
    matches,
  });
  const titleType =
    field.display === "tall"
      ? tennisTextStyles.heroDisplayTall
      : tennisTextStyles.heroDisplay;

  return (
    <View style={[styles.root, { backgroundColor: field.ground }]}>
      <StatusBar style={field.statusBar} />
      <Image
        source={field.art}
        resizeMode="cover"
        style={[styles.art, field.artStyle]}
        accessibilityIgnoresInvertColors
      />
      <HeroScrim
        anchor="bottom"
        height={field.bottomScrim.height}
        colors={field.bottomScrim.colors}
        locations={field.bottomScrim.locations}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 36,
            paddingBottom: 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pill, { backgroundColor: field.pillFill }]}>
          <AppText
            style={[tennisTextStyles.statusPill, { color: field.pillText }]}
          >
            {t("onboarding.complete.statusPill")}
          </AppText>
        </View>
        <View style={styles.spacer} />
        <AppText style={[titleType, { color: field.title }]}>
          {t("onboarding.complete.title")}
        </AppText>
        <AppText style={[titleType, { color: field.accent, marginBottom: 12 }]}>
          {t("onboarding.complete.titleAccent", { name })}
        </AppText>
        <AppText
          style={[
            tennisTextStyles.bodyLead,
            styles.description,
            { color: field.description },
          ]}
        >
          {t("onboarding.complete.description")}
        </AppText>

        {gift.kind === "listings" ? (
          <View style={styles.giftBlock}>
            <AppText
              style={[
                styles.giftTitle,
                field.giftSurface === "light"
                  ? styles.inkDark
                  : styles.inkLight,
              ]}
            >
              {t("onboarding.complete.giftTitle")}
            </AppText>
            {gift.matches.map((match) => (
              <GiftMatchRow
                key={match.match_id}
                match={match}
                surface={field.giftSurface}
              />
            ))}
          </View>
        ) : null}

        {gift.kind === "empty" ? (
          <View style={styles.giftBlock}>
            <AppText
              style={[
                styles.giftTitle,
                field.giftSurface === "light"
                  ? styles.inkDark
                  : styles.inkLight,
              ]}
            >
              {t("onboarding.complete.giftEmptyTitle")}
            </AppText>
            <AppText
              style={[styles.giftEmptyBody, { color: field.description }]}
            >
              {t("onboarding.complete.giftEmptyBody")}
            </AppText>
            <FigmaSecondaryButton
              label={t("home.openMatches.organise")}
              ghostOnDark={field.secondaryGhost === "dark"}
              ghostOnLight={field.secondaryGhost === "light"}
              onPress={() => startNewMatchCreate()}
            />
          </View>
        ) : null}

        {gift.kind === "error" ? (
          <View style={styles.giftBlock}>
            <AppText
              style={[styles.giftEmptyBody, { color: field.description }]}
            >
              {t("onboarding.complete.giftErrorBody")}
            </AppText>
            <FigmaSecondaryButton
              label={t("common.retry")}
              ghostOnDark={field.secondaryGhost === "dark"}
              ghostOnLight={field.secondaryGhost === "light"}
              onPress={() => {
                void matchesQuery.refetch();
                void clubsQuery.refetch();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: tennisSpacing.screenX,
          paddingBottom: insets.bottom + 34,
        }}
      >
        <FigmaPrimaryButton
          label={t("onboarding.complete.cta")}
          lime={field.cta === "lime"}
          hero={field.cta === "hero"}
          onPress={() => router.replace("/(tabs)")}
        />
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      overflow: "hidden",
    },
    art: {
      ...StyleSheet.absoluteFill,
      width: "100%",
      height: "100%",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: tennisSpacing.screenX,
    },
    pill: {
      alignSelf: "flex-start",
      paddingVertical: 7,
      paddingHorizontal: 13,
      borderRadius: tennisRadii.pill,
    },
    spacer: {
      flexGrow: 1,
      minHeight: 24,
    },
    description: {
      maxWidth: 300,
      marginBottom: 22,
    },
    giftBlock: {
      width: "100%",
      gap: 10,
      marginBottom: 8,
    },
    giftTitle: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 16,
      textAlign: "left",
    },
    giftEmptyBody: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
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
    },
    giftRowDark: {
      backgroundColor: tennisColors.heroOverlay,
      borderWidth: 1,
      borderColor: tennisColors.heroBorder,
    },
    giftRowLight: {
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
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
    },
    giftMeta: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
    },
    giftScarce: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
    },
    giftOpen: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
    },
    inkLight: {
      color: tennisColors.white,
    },
    inkDark: {
      color: tennisColors.heroOnLight,
    },
    metaDark: {
      color: "rgba(255,255,255,0.65)",
    },
    metaLight: {
      color: tennisColors.mutedForeground,
    },
    accentLime: {
      color: tennisColors.lime,
    },
    accentGreen: {
      color: tennisColors.heroGreen,
    },
  }),
);
