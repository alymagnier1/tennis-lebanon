import { StyleSheet, View } from "react-native";
import type {
  CompatiblePlayerCard,
  PublicPlayerAvailabilitySummary,
} from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon, type IconName } from "../Icon";
import { PlayerProfileSection } from "./PlayerProfileSection";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { playerFormatLabel } from "../../lib/player-format-label";
import {
  formatAvailabilityDayPartsLabel,
  hasPublicAvailabilitySummary,
  publicAvailabilityByWeekday,
} from "../../lib/public-availability-summary";
import { tennisColors } from "../../theme/tennis-tokens";

/**
 * Icon plus text rather than an emoji prefix: emoji render differently on every
 * platform, do not follow the text colour, and get read aloud by screen readers
 * as their own name before the line they decorate.
 */
function DetailLine({ icon, text }: { icon: IconName; text: string }) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
      <Icon name={icon} size={14} color={tennisColors.mutedForeground} />
      <AppText style={[styles.detailLine, { writingDirection }]}>
        {text}
      </AppText>
    </View>
  );
}

export function PlayerAvailabilitySection({
  player,
  summary,
}: {
  player: CompatiblePlayerCard;
  summary: PublicPlayerAvailabilitySummary | undefined;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const weekdayEntries = publicAvailabilityByWeekday(summary);
  const formatLabel = playerFormatLabel(player, t);
  const intentLabel = t(`playIntent.${player.play_intent}`);
  const hasSummary = hasPublicAvailabilitySummary(summary);

  return (
    <PlayerProfileSection title={t("playerProfile.availabilityTitle")}>
      {hasSummary && weekdayEntries.length > 0 ? (
        <View style={[styles.weekdayRow, { flexDirection: rowDirection }]}>
          {weekdayEntries.map((entry) => {
            const dayLabel = t(`availability.weekdaysShort.${entry.weekday}`);
            const partsLabel = formatAvailabilityDayPartsLabel(
              entry.day_parts,
              t,
            );

            return (
              <View key={entry.weekday} style={styles.weekdayChip}>
                <AppText style={styles.weekdayChipText}>{dayLabel}</AppText>
                {partsLabel ? (
                  <AppText style={styles.weekdayPartsText} maxLines={2}>
                    {partsLabel}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      <DetailLine
        icon="court"
        text={t("playerProfile.formatPreference", { format: formatLabel })}
      />
      <DetailLine
        icon="playIntent"
        text={t("playerProfile.intentPreference", { intent: intentLabel })}
      />
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    gap: 2,
    maxWidth: 120,
  },
  weekdayChipText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    color: tennisColors.primary,
  },
  weekdayPartsText: {
    fontFamily: tennisFontFamily.body,
    fontSize: 10,
    color: tennisColors.mutedForeground,
    textAlign: "center",
    lineHeight: 14,
  },
  detailRow: {
    alignItems: "center",
    gap: 6,
  },
  detailLine: {
    flexShrink: 1,
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
