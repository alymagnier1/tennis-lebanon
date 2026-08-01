import { StyleSheet, View } from "react-native";
import type {
  CompatiblePlayerCard,
  PublicPlayerAvailabilitySummary,
} from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { PlayerProfileSection } from "./PlayerProfileSection";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { playerFormatLabel } from "../../lib/player-format-label";
import {
  formatAvailabilityDayPartsLabel,
  hasPublicAvailabilitySummary,
  weekdayShortLabels,
} from "../../lib/public-availability-summary";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

export function PlayerAvailabilitySection({
  player,
  summary,
}: {
  player: CompatiblePlayerCard;
  summary: PublicPlayerAvailabilitySummary | undefined;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const weekdayLabels = weekdayShortLabels(summary?.weekdays ?? [], t);
  const dayPartsLabel = formatAvailabilityDayPartsLabel(
    summary?.day_parts ?? [],
    t,
  );
  const formatLabel = playerFormatLabel(player, t);
  const intentLabel = t(`playIntent.${player.play_intent}`);
  const hasSummary = hasPublicAvailabilitySummary(summary);

  return (
    <PlayerProfileSection title={t("playerProfile.availabilityTitle")}>
      {hasSummary && weekdayLabels.length > 0 ? (
        <View style={[styles.weekdayRow, { flexDirection: rowDirection }]}>
          {weekdayLabels.map((label) => (
            <View key={label} style={styles.weekdayChip}>
              <AppText style={styles.weekdayChipText}>{label}</AppText>
            </View>
          ))}
        </View>
      ) : null}
      {dayPartsLabel ? (
        <AppText style={[styles.detailLine, { writingDirection }]}>
          {`⏰ ${dayPartsLabel}`}
        </AppText>
      ) : null}
      <AppText style={[styles.detailLine, { writingDirection }]}>
        {`🎾 ${t("playerProfile.formatPreference", { format: formatLabel })}`}
      </AppText>
      <AppText style={[styles.detailLine, { writingDirection }]}>
        {`🎯 ${t("playerProfile.intentPreference", { intent: intentLabel })}`}
      </AppText>
      {!hasSummary ? (
        <AppText style={[styles.emptyHint, { writingDirection }]}>
          {t("playerProfile.noAvailability")}
        </AppText>
      ) : null}
    </PlayerProfileSection>
  );
}

const styles = StyleSheet.create({
  weekdayRow: {
    flexWrap: "wrap",
    gap: 6,
  },
  weekdayChip: {
    backgroundColor: tennisColors.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  weekdayChipText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    color: tennisColors.primary,
  },
  detailLine: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
    lineHeight: 20,
  },
  emptyHint: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
});
