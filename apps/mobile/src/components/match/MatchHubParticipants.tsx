import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
  is_creator?: boolean;
  avatar_path?: string | null;
};

export function MatchHubParticipants({
  participants,
}: {
  participants: HubParticipant[];
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  if (participants.length === 0) return null;

  return (
    <View style={styles.root}>
      <AppText style={styles.sectionLabel}>
        {t("matches.hub.participants")}
      </AppText>
      <View style={styles.list}>
        {participants.map((participant) => (
          <View
            key={participant.user_id}
            style={[styles.row, { flexDirection: rowDirection }]}
          >
            <Avatar
              name={participant.display_name}
              avatarPath={participant.avatar_path}
              size={40}
            />
            <View style={styles.text}>
              <AppText
                style={[styles.name, { writingDirection }]}
                maxLines={1}
              >
                {participant.display_name}
              </AppText>
              <AppText
                style={[styles.meta, { writingDirection }]}
                maxLines={1}
              >
                {[
                  participant.is_creator ? t("matches.hub.hostBadge") : null,
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
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  list: {
    gap: 10,
  },
  row: {
    alignItems: "center",
    gap: 12,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
  meta: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
});
