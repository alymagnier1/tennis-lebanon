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
  weekdayShortLabels,
} from "../../lib/public-availability-summary";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

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
      {dayPartsLabel ? <DetailLine icon="clock" text={dayPartsLabel} /> : null}
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
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  weekdayChipText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    color: tennisColors.primary,
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
