import { StyleSheet, View } from "react-native";
import type { PublicPlayerRecentMatch } from "@tennis-lebanon/api";
import { formatMatchScore, matchScoreSchema } from "@tennis-lebanon/domain";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { PlayerProfileSection } from "./PlayerProfileSection";
import { formatShortUtcDateInBeirut } from "../../lib/beirut-time";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

function formatScore(score: unknown): string | null {
  const parsed = matchScoreSchema.safeParse(score);
  if (!parsed.success) return null;
  return formatMatchScore(parsed.data);
}

export function PlayerRecentMatchesSection({
  matches,
}: {
  matches: PublicPlayerRecentMatch[];
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <PlayerProfileSection title={t("playerProfile.recentMatchesTitle")}>
      {matches.length === 0 ? (
        <AppText style={[styles.emptyHint, { writingDirection }]}>
          {t("playerProfile.noRecentMatches")}
        </AppText>
      ) : (
        matches.map((match, index) => {
          const resultLabel = match.player_won
            ? t("playerProfile.matchWin")
            : t("playerProfile.matchLoss");
          const scoreLabel = formatScore(match.score);
          const dateLabel = match.played_at
            ? formatShortUtcDateInBeirut(match.played_at)
            : null;

          return (
            <View
              key={`${match.opponent_names ?? "match"}-${index}`}
              style={[
                styles.row,
                { flexDirection: rowDirection },
                index < matches.length - 1 && styles.rowBorder,
              ]}
            >
              <View
                style={[
                  styles.resultBadge,
                  match.player_won
                    ? styles.resultBadgeWin
                    : styles.resultBadgeLoss,
                ]}
              >
                <AppText
                  style={[
                    styles.resultBadgeText,
                    match.player_won
                      ? styles.resultBadgeTextWin
                      : styles.resultBadgeTextLoss,
                  ]}
                >
                  {resultLabel}
                </AppText>
              </View>
              <View style={styles.rowBody}>
                <AppText
                  style={[styles.opponent, { writingDirection }]}
                  maxLines={1}
                >
                  {t("playerProfile.vsOpponent", {
                    name:
                      match.opponent_names ??
                      t("playerProfile.unknownOpponent"),
                  })}
                </AppText>
                {scoreLabel ? (
                  <AppText style={[styles.score, { writingDirection }]}>
                    {scoreLabel}
                  </AppText>
                ) : null}
              </View>
              {dateLabel ? (
                <AppText style={styles.date}>{dateLabel}</AppText>
              ) : null}
            </View>
          );
        })
      )}
    </PlayerProfileSection>
  );
}

const styles = StyleSheet.create({
  emptyHint: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  row: {
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
    marginBottom: 12,
  },
  resultBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  resultBadgeWin: {
    backgroundColor: "#E8F5E9",
  },
  resultBadgeLoss: {
    backgroundColor: "#FEF0E7",
  },
  resultBadgeText: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 13,
  },
  resultBadgeTextWin: {
    color: "#4CAF50",
  },
  resultBadgeTextLoss: {
    color: tennisColors.accent,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  opponent: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  score: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    color: tennisColors.mutedForeground,
  },
  date: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    color: tennisColors.mutedForeground,
    flexShrink: 0,
  },
});
