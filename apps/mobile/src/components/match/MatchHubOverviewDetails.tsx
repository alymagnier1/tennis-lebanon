import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import type { MatchHubCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { SemanticBadge } from "../SemanticBadge";
import { useLayoutDirection } from "../../lib/layout-direction";
import { toneForMatchStatus } from "../../lib/match-status-tone";
import {
  matchHubJoinSummary,
  matchHubLevelSummary,
} from "../../lib/match-hub-summaries";
import { zoneLabelFromList } from "../../lib/zones";
import { clubLabelFromList } from "../../lib/match-clubs";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/** Discovery-phase metadata: status badges and preference chips. */
export function MatchHubOverviewDetails({ hub }: { hub: MatchHubCard }) {
  const { t, i18n } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const zoneLabels = zoneLabelFromList(hub.zones, locale);
  const clubLabels = clubLabelFromList(hub.preferred_clubs);

  const showRosterBadge =
    hub.participant_count < hub.capacity ||
    hub.status === "open" ||
    hub.status === "full";

  const detailChips = [
    t(`formats.${hub.format}`),
    t(`playIntent.${hub.intent}`),
    matchHubLevelSummary(hub, t),
    matchHubJoinSummary(hub, t),
    zoneLabels,
    clubLabels,
  ].filter(Boolean);

  return (
    <View style={styles.root}>
      <View style={[styles.badgeRow, { flexDirection: rowDirection }]}>
        <SemanticBadge
          label={t(`matches.status.${hub.status}`)}
          tone={toneForMatchStatus(hub.status)}
        />
        {showRosterBadge ? (
          <SemanticBadge
            label={t("matches.hub.participantRoster", {
              current: hub.participant_count,
              capacity: hub.capacity,
            })}
            tone="neutral"
          />
        ) : null}
      </View>

      {detailChips.length > 0 ? (
        <View style={[styles.chipRow, { flexDirection: rowDirection }]}>
          {detailChips.map((chip) => (
            <View key={chip} style={styles.detailChip}>
              <AppText style={styles.detailChipText} maxLines={2}>
                {chip}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {hub.notes ? (
        <View style={styles.notesBlock}>
          <AppText style={styles.sectionLabel}>
            {t("matches.create.notes")}
          </AppText>
          <AppText style={[styles.notes, { writingDirection }]}>
            {hub.notes}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      gap: 14,
    },
    badgeRow: {
      flexWrap: "wrap",
      gap: 8,
    },
    chipRow: {
      flexWrap: "wrap",
      gap: 8,
    },
    detailChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: tennisRadii.pill,
      backgroundColor: tennisColors.muted,
      borderWidth: 1,
      borderColor: tennisColors.border,
      maxWidth: "100%",
    },
    detailChipText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.primaryDark,
    },
    sectionLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      color: tennisColors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 8,
    },
    notesBlock: {
      gap: 4,
    },
    notes: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.primaryDark,
    },
  }),
);
