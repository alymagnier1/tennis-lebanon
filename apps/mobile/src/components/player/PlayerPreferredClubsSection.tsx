import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { PlayerProfileSection } from "./PlayerProfileSection";
import { clubDetailRoute } from "../../lib/routes";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * Public preferred clubs — listed after About, before Availability.
 */
export function PlayerPreferredClubsSection({
  player,
}: {
  player: CompatiblePlayerCard;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const clubs = player.favorite_clubs;

  if (clubs.length === 0) {
    return null;
  }

  return (
    <PlayerProfileSection dense title={t("playerProfile.favoriteClubsTitle")}>
      <View style={styles.list}>
        {clubs.map((club) => (
          <Pressable
            key={club.club_id}
            accessibilityRole="button"
            accessibilityLabel={t("matches.hub.openClubDetails", {
              club: club.name,
            })}
            onPress={() => router.push(clubDetailRoute(club.club_id))}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={({ pressed }) => [
              styles.clubRow,
              { flexDirection: rowDirection },
              pressed && styles.clubRowPressed,
            ]}
          >
            <Icon name="place" size={14} color={tennisColors.mutedForeground} />
            <AppText
              style={[styles.clubName, { writingDirection }]}
              maxLines={1}
            >
              {club.name}
            </AppText>
          </Pressable>
        ))}
      </View>
    </PlayerProfileSection>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    list: {
      gap: 0,
    },
    clubRow: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 3,
    },
    clubRowPressed: {
      opacity: 0.88,
    },
    clubName: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
  }),
);
