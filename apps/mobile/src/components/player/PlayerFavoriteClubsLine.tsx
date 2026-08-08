import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { clubLabelFromList } from "../../lib/match-clubs";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function PlayerFavoriteClubsLine({
  player,
}: {
  player: CompatiblePlayerCard;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const label = clubLabelFromList(player.favorite_clubs);

  if (!label) {
    return null;
  }

  return (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <Icon name="clubs" size={14} color={tennisColors.primary} />
      <View style={styles.textBlock}>
        <AppText style={styles.title}>{t("playerProfile.favoriteClubsTitle")}</AppText>
        <AppText style={[styles.value, { writingDirection }]}>{label}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.primaryDark,
  },
  value: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
});
