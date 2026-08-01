import { StyleSheet, View } from "react-native";
import type { MatchHubCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { SplitSection } from "../TabSectionSplitter";
import { AppText } from "../AppText";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  matchHubJoinSummary,
  matchHubLevelSummary,
} from "../../lib/match-hub-summaries";
import { zoneLabelFromList } from "../../lib/zones";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
  is_creator?: boolean;
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

  return (
    <View style={styles.root}>
      <View style={styles.statusPill}>
        <AppText style={styles.statusPillText} maxLines={1}>
          {t(`matches.status.${hub.status}`)} ·{" "}
          {t("matches.hub.participantRoster", {
            current: hub.participant_count,
            capacity: hub.capacity,
          })}
        </AppText>
      </View>

      {participants.length > 0 ? (
        <SplitSection label={t("matches.hub.participants")} showDivider={false}>
          <View style={styles.participantList}>
            {participants.map((participant) => (
              <View
                key={participant.user_id}
                style={[styles.participantRow, { flexDirection: rowDirection }]}
              >
                <View style={styles.participantAvatar}>
                  <AppText style={styles.participantInitials} maxLines={1}>
                    {participant.display_name.slice(0, 2).toUpperCase()}
                  </AppText>
                </View>
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
        </SplitSection>
      ) : null}

      <SplitSection
        label={t("discover.formatFilter")}
        showDivider={participants.length > 0}
      >
        <HubDetailValue value={t(`formats.${hub.format}`)} />
      </SplitSection>

      <SplitSection label={t("discover.intentFilter")}>
        <HubDetailValue value={t(`playIntent.${hub.intent}`)} />
      </SplitSection>

      <SplitSection label={t("matches.create.matchLevel")}>
        <HubDetailValue value={matchHubLevelSummary(hub, t)} />
      </SplitSection>

      <SplitSection label={t("matches.create.joinSettingsSection")}>
        <HubDetailValue value={matchHubJoinSummary(hub, t)} />
      </SplitSection>

      {zoneLabels ? (
        <SplitSection label={t("discover.zonesFilter")}>
          <HubDetailValue value={zoneLabels} />
        </SplitSection>
      ) : null}

      {hub.notes ? (
        <SplitSection label={t("matches.create.notes")}>
          <AppText style={[styles.notes, { writingDirection }]}>
            {hub.notes}
          </AppText>
        </SplitSection>
      ) : null}
    </View>
  );
}

function HubDetailValue({ value }: { value: string }) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.valueCard}>
      <AppText style={[styles.valueText, { writingDirection }]} maxLines={4}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tennisRadii.pill,
    backgroundColor: tennisColors.secondary,
    marginBottom: 4,
  },
  statusPillText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    color: tennisColors.primaryDark,
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
  valueCard: {
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    borderRadius: tennisRadii.md,
    backgroundColor: tennisColors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  valueText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
  notes: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.primaryDark,
  },
});
