import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ClubDirectoryRow } from "@tennis-lebanon/api";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { useLayoutDirection } from "../lib/layout-direction";
import { zoneNameFromJson } from "../lib/zones";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import type { Json } from "@tennis-lebanon/types";

type PreferredClubPickerProps = {
  clubs: ClubDirectoryRow[];
  selectedClubIds: string[];
  onToggle: (clubId: string) => void;
  maxSelected?: number;
};

function sortClubsFavoritesFirst(
  clubs: ClubDirectoryRow[],
): ClubDirectoryRow[] {
  return [...clubs].sort((left, right) => {
    if (left.is_favorite === right.is_favorite) {
      return left.name.localeCompare(right.name);
    }
    return left.is_favorite ? -1 : 1;
  });
}

export function PreferredClubPicker({
  clubs,
  selectedClubIds,
  onToggle,
  maxSelected = 3,
}: PreferredClubPickerProps) {
  const { t, i18n } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const sorted = sortClubsFavoritesFirst(clubs);

  if (sorted.length === 0) {
    return (
      <AppText style={styles.empty}>
        {t("matches.create.preferredClubsEmpty")}
      </AppText>
    );
  }

  return (
    <View style={styles.list}>
      {sorted.map((club) => {
        const selected = selectedClubIds.includes(club.club_id);
        const disabled = !selected && selectedClubIds.length >= maxSelected;

        return (
          <Pressable
            key={club.club_id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={club.name}
            disabled={disabled}
            onPress={() => onToggle(club.club_id)}
            style={({ pressed }) => [
              styles.row,
              { flexDirection: rowDirection },
              selected && styles.rowSelected,
              disabled && styles.rowDisabled,
              pressed && !disabled && styles.rowPressed,
            ]}
          >
            <View
              style={[
                styles.checkbox,
                selected && styles.checkboxSelected,
                disabled && styles.checkboxDisabled,
              ]}
            >
              {selected ? (
                <Icon name="check" size={14} color={tennisColors.white} />
              ) : null}
            </View>
            <View style={styles.textBlock}>
              <View style={[styles.nameRow, { flexDirection: rowDirection }]}>
                <AppText
                  style={[styles.name, { writingDirection }]}
                  maxLines={1}
                >
                  {club.name}
                </AppText>
                {club.is_favorite ? (
                  <AppText style={styles.favorite}>
                    {t("clubs.favorite")}
                  </AppText>
                ) : null}
              </View>
              <AppText style={[styles.zone, { writingDirection }]} maxLines={1}>
                {zoneNameFromJson(
                  club.zone_name_i18n as Json,
                  i18n.resolvedLanguage ?? i18n.language,
                )}
              </AppText>
            </View>
          </Pressable>
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
  rowSelected: {
    borderColor: tennisColors.primary,
    backgroundColor: tennisColors.secondary,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowPressed: {
    opacity: 0.9,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tennisColors.card,
  },
  checkboxSelected: {
    borderColor: tennisColors.primary,
    backgroundColor: tennisColors.primary,
  },
  checkboxDisabled: {
    borderColor: tennisColors.muted,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
  favorite: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    color: tennisColors.primary,
  },
  zone: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  empty: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
  },
});
