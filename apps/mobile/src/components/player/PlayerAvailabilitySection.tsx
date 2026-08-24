import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
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
import {
  formatAvailabilityDayPartsLabel,
  formatWeeklyDaysLabel,
  hasPublicAvailabilitySummary,
} from "../../lib/public-availability-summary";
import { formatTodayAvailabilityTime } from "../../lib/beirut-time";
import { tennisColors } from "../../theme/tennis-tokens";

function FactRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View style={[styles.factRow, { flexDirection: rowDirection }]}>
      <Icon name={icon} size={14} color={tennisColors.mutedForeground} />
      <AppText style={[styles.factLabel, { writingDirection }]}>
        {label}
      </AppText>
      <AppText
        style={[
          styles.factValue,
          {
            writingDirection,
            textAlign: writingDirection === "rtl" ? "left" : "right",
          },
        ]}
        maxLines={1}
      >
        {value}
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
  const { writingDirection } = useLayoutDirection();
  const hasSummary = hasPublicAvailabilitySummary(summary);
  const preferredTime = summary
    ? formatAvailabilityDayPartsLabel(summary.day_parts, t)
    : "";
  const weeklyDays = summary ? formatWeeklyDaysLabel(summary.weekdays, t) : "";
  const todayTime = formatTodayAvailabilityTime(player.near_term_slots);

  return (
    <PlayerProfileSection dense title={t("playerProfile.availabilityTitle")}>
      {hasSummary ? (
        <View style={styles.list}>
          {preferredTime ? (
            <FactRow
              icon="clock"
              label={t("playerProfile.preferredTimeLabel")}
              value={preferredTime}
            />
          ) : null}
          {todayTime ? (
            <FactRow
              icon="calendar"
              label={t("playerProfile.availableTodayLabel")}
              value={todayTime}
            />
          ) : null}
          {weeklyDays ? (
            <FactRow
              icon="calendar"
              label={t("playerProfile.weeklyLabel")}
              value={weeklyDays}
            />
          ) : null}
        </View>
      ) : (
        <AppText style={[styles.emptyHint, { writingDirection }]}>
          {t("playerProfile.noAvailability")}
        </AppText>
      )}
    </PlayerProfileSection>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    list: {
      gap: 0,
    },
    factRow: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 3,
    },
    factLabel: {
      flexGrow: 0,
      flexShrink: 0,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    factValue: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 18,
      color: tennisColors.primaryDark,
    },
    emptyHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
  }),
);
