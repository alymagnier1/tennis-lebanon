import { StyleSheet, View } from "react-native";
import type { MatchHubCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
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

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
  is_creator?: boolean;
  avatar_path?: string | null;
};

export function MatchHubOverviewDetails({
  hub,
  participants,
}: {
  hub: MatchHubCard;
  participants: HubParticipant[];
}) {
  const { t, i18n } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const zoneLabels = zoneLabelFromList(hub.zones, locale);
  const clubLabels = clubLabelFromList(hub.preferred_clubs);

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
        <SemanticBadge
          label={t("matches.hub.participantRoster", {
            current: hub.participant_count,
            capacity: hub.capacity,
          })}
          tone="neutral"
        />
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

      {participants.length > 0 ? (
        <View style={styles.participantBlock}>
          <AppText style={styles.sectionLabel}>
            {t("matches.hub.participants")}
          </AppText>
          <View style={styles.participantList}>
            {participants.map((participant) => (
              <View
                key={participant.user_id}
                style={[styles.participantRow, { flexDirection: rowDirection }]}
              >
                <Avatar
                  name={participant.display_name}
                  avatarPath={participant.avatar_path}
                  size={40}
                />
                <View style={styles.participantText}>
                  <AppText
                    style={[styles.participantName, { writingDirection }]}
                    maxLines={1}
                  >
                    {participant.display_name}
                  </AppText>
                  <AppText
                    style={[styles.participantMeta, { writingDirection }]}
                    maxLines={1}
                  >
                    {[
                      participant.is_creator
                        ? t("matches.hub.hostBadge")
                        : null,
                      t(`matches.participantStatus.${participant.status}`),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
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

const styles = StyleSheet.create({
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
  participantBlock: {
    gap: 4,
  },
  participantList: {
    gap: 10,
  },
  participantRow: {
    alignItems: "center",
    gap: 12,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tennisColors.lime,
  },
  participantInitials: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 14,
    color: tennisColors.primaryDark,
  },
  participantText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  participantName: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
  participantMeta: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
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
});
