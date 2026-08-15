import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { PlayerProfileSection } from "./PlayerProfileSection";
import { clubDetailRoute } from "../../lib/routes";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * Public preferred clubs under Availability — venue preference before Recent
 * matches / invite actions.
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
    <PlayerProfileSection title={t("playerProfile.favoriteClubsTitle")}>
      <View style={styles.list}>
        {clubs.map((club) => (
          <Pressable
            key={club.club_id}
            accessibilityRole="button"
            accessibilityLabel={t("matches.hub.openClubDetails", {
              club: club.name,
            })}
            onPress={() => router.push(clubDetailRoute(club.club_id))}
            style={({ pressed }) => [
              styles.clubRow,
              { flexDirection: rowDirection },
              pressed && styles.clubRowPressed,
            ]}
          >
            <View style={styles.clubIcon}>
              <Icon name="place" size={16} color={tennisColors.white} />
            </View>
            <AppText
              style={[styles.clubName, { writingDirection }]}
              maxLines={2}
            >
              {club.name}
            </AppText>
            <View style={[styles.viewTrail, { flexDirection: rowDirection }]}>
              <AppText style={styles.viewLabel} maxLines={1}>
                {t("clubs.viewDetails")}
              </AppText>
              <Icon name="chevron" size={14} color={tennisColors.primary} />
            </View>
          </Pressable>
        ))}
      </View>
    </PlayerProfileSection>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  clubRow: {
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: tennisRadii.md,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
  },
  clubRowPressed: {
    opacity: 0.88,
  },
  clubIcon: {
    width: 32,
    height: 32,
    borderRadius: tennisRadii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E09A5C",
  },
  clubName: {
    flex: 1,
    minWidth: 0,
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 14,
    lineHeight: 18,
    color: tennisColors.primaryDark,
  },
  viewTrail: {
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  viewLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.primary,
  },
});
