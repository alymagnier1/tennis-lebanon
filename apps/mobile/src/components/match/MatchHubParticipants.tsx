import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
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
  viewerUserId,
}: {
  participants: HubParticipant[];
  /** Own row is not a link: `/player/[id]` is the public card, not your profile. */
  viewerUserId?: string;
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
        {participants.map((participant) => {
          const isSelf = participant.user_id === viewerUserId;
          const body = (
            <>
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
            </>
          );

          if (isSelf) {
            return (
              <View
                key={participant.user_id}
                style={[styles.row, { flexDirection: rowDirection }]}
              >
                {body}
              </View>
            );
          }

          // The whole row, not just the avatar: a 40px circle is under the
          // touch target minimum, and the name is the same identity. This is
          // also the only route from a match to report or block someone.
          return (
            <Pressable
              key={participant.user_id}
              accessibilityRole="button"
              // Same string as the discover list; no reason to duplicate the copy.
              accessibilityLabel={t("discover.openPlayerProfile", {
                name: participant.display_name,
              })}
              onPress={() =>
                router.push({
                  pathname: "/player/[id]",
                  params: { id: participant.user_id },
                })
              }
              style={({ pressed }) => [
                styles.row,
                { flexDirection: rowDirection },
                pressed && styles.rowPressed,
              ]}
            >
              {body}
            </Pressable>
          );
        })}
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
    minHeight: minTouchTargetPx,
  },
  rowPressed: {
    opacity: 0.6,
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
