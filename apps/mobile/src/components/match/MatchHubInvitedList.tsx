import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { HubDestructiveLink } from "./HubSummaryRow";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { hubSectionStyles } from "./hub-section-styles";

export type HubInvitedPlayer = {
  user_id: string;
  display_name: string;
  status: string;
  avatar_path?: string | null;
};

export function MatchHubInvitedList({
  invited,
  withdrawing,
  onWithdraw,
}: {
  invited: HubInvitedPlayer[];
  withdrawing?: boolean;
  onWithdraw: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  if (invited.length === 0) return null;

  return (
    <View style={hubSectionStyles.root}>
      <AppText style={hubSectionStyles.sectionLabel}>
        {t("matches.hub.invitedTitle")}
      </AppText>
      <View style={styles.card}>
        {invited.map((player, index) => {
          const declined = player.status === "declined";
          const onHold = player.status === "superseded";
          const dimmed = declined;

          return (
            <View key={player.user_id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={[styles.row, { flexDirection: rowDirection }]}>
                <Avatar
                  name={player.display_name}
                  avatarPath={player.avatar_path}
                  size={44}
                />
                <View style={styles.copy}>
                  <View
                    style={[styles.identity, { flexDirection: rowDirection }]}
                  >
                    <AppText
                      style={[
                        styles.name,
                        dimmed && styles.nameDimmed,
                        { writingDirection },
                      ]}
                      maxLines={1}
                    >
                      {player.display_name}
                    </AppText>
                    {!declined ? (
                      <View style={styles.withdraw}>
                        <HubDestructiveLink
                          label={t("matches.hub.cancelInvite")}
                          disabled={withdrawing}
                          onPress={() => onWithdraw(player.user_id)}
                        />
                      </View>
                    ) : null}
                  </View>
                  <AppText
                    style={[
                      styles.status,
                      declined && styles.statusDeclined,
                      { writingDirection },
                    ]}
                    maxLines={1}
                  >
                    {declined
                      ? t("matches.hub.invitedDeclined")
                      : onHold
                        ? t("matches.hub.invitedOnHold")
                        : t("matches.hub.invitedWaiting")}
                  </AppText>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      backgroundColor: tennisColors.card,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      overflow: "hidden",
    },
    row: {
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 64,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: tennisColors.border,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    identity: {
      alignItems: "center",
      gap: 12,
    },
    name: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.headingMedium,
      fontSize: 15,
      lineHeight: 19,
      color: tennisColors.primaryDark,
    },
    nameDimmed: {
      color: tennisColors.mutedForeground,
    },
    status: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    statusDeclined: {
      color: tennisColors.danger,
    },
    withdraw: {
      flexShrink: 0,
    },
  }),
);
