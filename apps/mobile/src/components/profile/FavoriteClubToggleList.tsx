import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ClubDirectoryRow } from "@tennis-lebanon/api";
import { AppText } from "../AppText";
import { useLayoutDirection } from "../../lib/layout-direction";
import { zoneNameFromJson } from "../../lib/zones";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import type { Json } from "@tennis-lebanon/types";

type FavoriteClubToggleListProps = {
  clubs: ClubDirectoryRow[];
  loading?: boolean;
  pendingClubId?: string | null;
  onToggleFavorite: (clubId: string, favorite: boolean) => void;
};

function sortClubsFavoritesFirst(clubs: ClubDirectoryRow[]): ClubDirectoryRow[] {
  return [...clubs].sort((left, right) => {
    if (left.is_favorite === right.is_favorite) {
      return left.name.localeCompare(right.name);
    }
    return left.is_favorite ? -1 : 1;
  });
}

export function FavoriteClubToggleList({
  clubs,
  loading = false,
  pendingClubId = null,
  onToggleFavorite,
}: FavoriteClubToggleListProps) {
  const { t, i18n } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const sorted = sortClubsFavoritesFirst(clubs);

  if (loading) {
    return <ActivityIndicator color={tennisColors.primary} />;
  }

  if (sorted.length === 0) {
    return (
      <AppText style={styles.empty}>
        {t("profile.whereIPlay.clubsEmpty")}
      </AppText>
    );
  }

  return (
    <View style={styles.list}>
      {sorted.map((club) => {
        const pending = pendingClubId === club.club_id;

        return (
          <View
            key={club.club_id}
            style={[styles.row, { flexDirection: rowDirection }]}
          >
            <View style={styles.textBlock}>
              <AppText
                style={[styles.name, { writingDirection }]}
                maxLines={1}
              >
                {club.name}
              </AppText>
              <AppText style={[styles.zone, { writingDirection }]} maxLines={1}>
                {zoneNameFromJson(
                  club.zone_name_i18n as Json,
                  i18n.resolvedLanguage ?? i18n.language,
                )}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                club.is_favorite
                  ? t("clubs.unfavorite")
                  : t("clubs.favorite")
              }
              disabled={pending}
              onPress={() => onToggleFavorite(club.club_id, !club.is_favorite)}
              style={({ pressed }) => [
                styles.favoriteButton,
                club.is_favorite && styles.favoriteButtonActive,
                pressed && styles.favoriteButtonPressed,
                pending && styles.favoriteButtonPending,
              ]}
            >
              <AppText
                style={[
                  styles.favoriteButtonLabel,
                  club.is_favorite && styles.favoriteButtonLabelActive,
                ]}
              >
                {club.is_favorite
                  ? t("clubs.favorite")
                  : t("profile.whereIPlay.addFavorite")}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: tennisRadii.md,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
  zone: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  favoriteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
  },
  favoriteButtonActive: {
    borderColor: tennisColors.primary,
    backgroundColor: tennisColors.secondary,
  },
  favoriteButtonPressed: {
    opacity: 0.9,
  },
  favoriteButtonPending: {
    opacity: 0.55,
  },
  favoriteButtonLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
  favoriteButtonLabelActive: {
    color: tennisColors.primary,
  },
  empty: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
});
