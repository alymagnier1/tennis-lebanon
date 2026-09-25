import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import type { ClubDirectoryRow } from "@tennis-lebanon/api";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { useLayoutDirection } from "../lib/layout-direction";
import { zoneNameFromJson } from "../lib/zones";
import { tennisColors } from "../theme/tennis-tokens";
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

/**
 * Hub-style name rows in one card (same skeleton as MatchHubPreferredClubs
 * compact): check + name · area. Favourites still sort first.
 */
export function PreferredClubPicker({
  clubs,
  selectedClubIds,
  onToggle,
  maxSelected = 3,
}: PreferredClubPickerProps) {
  const { t, i18n } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const sorted = sortClubsFavoritesFirst(clubs);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  if (sorted.length === 0) {
    return (
      <AppText style={styles.empty}>
        {t("matches.create.preferredClubsEmpty")}
      </AppText>
    );
  }

  return (
    <View style={styles.card}>
      {sorted.map((club, index) => {
        const selected = selectedClubIds.includes(club.club_id);
        const disabled = !selected && selectedClubIds.length >= maxSelected;
        const zoneLabel = zoneNameFromJson(club.zone_name_i18n as Json, locale);

        return (
          <View key={club.club_id}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <Pressable
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
                  styles.check,
                  selected && styles.checkSelected,
                  disabled && styles.checkDisabled,
                ]}
              >
                {selected ? (
                  <Icon name="checkMark" size={12} color={tennisColors.white} />
                ) : null}
              </View>

              <View style={[styles.main, { flexDirection: rowDirection }]}>
                <AppText
                  style={[styles.name, { writingDirection }]}
                  maxLines={1}
                >
                  {club.name}
                </AppText>
                {zoneLabel ? (
                  <AppText style={styles.meta} maxLines={1}>
                    {zoneLabel}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      backgroundColor: tennisColors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: tennisColors.border,
      overflow: "hidden",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: tennisColors.border,
    },
    row: {
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 48,
    },
    rowSelected: {
      backgroundColor: tennisColors.quietFill,
    },
    rowDisabled: {
      opacity: 0.45,
    },
    rowPressed: {
      opacity: 0.88,
    },
    check: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tennisColors.card,
      flexShrink: 0,
    },
    checkSelected: {
      borderColor: tennisColors.primary,
      backgroundColor: tennisColors.primary,
    },
    checkDisabled: {
      borderColor: tennisColors.muted,
    },
    main: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 8,
    },
    name: {
      flexShrink: 1,
      fontFamily: tennisFontFamily.headingMedium,
      fontSize: 15,
      lineHeight: 19,
      color: tennisColors.primaryDark,
    },
    meta: {
      flexShrink: 0,
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    empty: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.mutedForeground,
    },
  }),
);
