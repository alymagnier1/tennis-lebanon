import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PROVISIONAL_RATING_MATCH_THRESHOLD } from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { useLayoutDirection } from "../../lib/layout-direction";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * The player's rating on Home, in one slim card.
 *
 * It replaced a progress bar, a sentence and a two-number card that said the
 * same things: "0 matches" was already in the greeting, and rating progress
 * was shown three times (founder, 2026-09-27). The bar is split into one step
 * per confirmed result because that is how the rating unlocks, and a row of
 * empty steps still reads as progress, where one empty bar read as a divider.
 */
export function HomeRatingCard({
  provisional,
  ratedMatchCount,
  remaining,
  ratingValue,
  awaitingScore,
  onExplain,
  onOpenAwaitingScore,
}: {
  provisional: boolean;
  ratedMatchCount: number;
  remaining: number;
  /** Shown once the rating is visible. */
  ratingValue: string;
  /** Completed matches still waiting for a confirmed score. */
  awaitingScore: number;
  onExplain: () => void;
  onOpenAwaitingScore: () => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const title = t("home.ratingProgress.title");

  const heading = (trailing: React.ReactNode, label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t("profile.ratingExplainerTitle")}
      onPress={onExplain}
      hitSlop={{ top: 10, bottom: 10 }}
      style={({ pressed }) => [
        styles.headingRow,
        { flexDirection: rowDirection },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.titleRow, { flexDirection: rowDirection }]}>
        <AppText style={[styles.title, { writingDirection }]}>{title}</AppText>
        <Icon name="info" size={13} color={tennisColors.mutedForeground} />
      </View>
      {trailing}
    </Pressable>
  );

  if (!provisional) {
    return (
      <View style={[styles.card, styles.cardUnlocked]}>
        {heading(
          <AppText style={styles.value}>{ratingValue}</AppText>,
          `${title}, ${ratingValue}`,
        )}
      </View>
    );
  }

  const threshold = PROVISIONAL_RATING_MATCH_THRESHOLD;
  const done = Math.min(ratedMatchCount, threshold);
  const progressLabel = t("home.ratingProgress.progress", { done, threshold });
  const remainingLabel = t("home.ratingProgress.remaining", {
    count: remaining,
  });

  return (
    <View style={styles.card}>
      {heading(
        <AppText style={[styles.count, { writingDirection }]}>
          {progressLabel}
        </AppText>,
        `${title}, ${progressLabel}`,
      )}

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={title}
        accessibilityValue={{
          min: 0,
          max: threshold,
          now: done,
          text: remainingLabel,
        }}
        style={[styles.steps, { flexDirection: rowDirection }]}
      >
        {Array.from({ length: threshold }, (_, index) => (
          <View
            key={index}
            style={[styles.step, index < done && styles.stepDone]}
          />
        ))}
      </View>

      {/* The progress bar already announces this. */}
      <AppText
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[styles.caption, { writingDirection }]}
      >
        {remainingLabel}
      </AppText>

      {awaitingScore > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.ratingProgress.awaitingScoreAction")}
          onPress={onOpenAwaitingScore}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <AppText style={[styles.link, { writingDirection }]}>
            {t("home.ratingProgress.awaitingScore", {
              pending: awaitingScore,
            })}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      marginTop: 14,
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: tennisRadii.md,
      borderWidth: 1,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
    },
    cardUnlocked: {
      paddingVertical: 10,
    },
    headingRow: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    titleRow: {
      alignItems: "center",
      gap: 4,
    },
    title: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.primaryDark,
    },
    count: {
      flexShrink: 1,
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    value: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 20,
      lineHeight: 24,
      color: tennisColors.primaryDark,
      letterSpacing: -0.3,
    },
    steps: {
      gap: 4,
    },
    step: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: tennisColors.border,
    },
    stepDone: {
      backgroundColor: tennisColors.violet,
    },
    caption: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    link: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.violetText,
      textDecorationLine: "underline",
    },
    pressed: {
      opacity: 0.7,
    },
  }),
);
