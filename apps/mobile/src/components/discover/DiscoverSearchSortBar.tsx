import { StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Icon } from "../Icon";
import { DiscoverSortControl } from "./DiscoverSortControl";
import type { DiscoverSortMode } from "../../lib/discover-sort";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * Second Discover header row: text search + sort, kept separate from the
 * match-filter chips so chips stay one job and search/sort stay always visible.
 */
export function DiscoverSearchSortBar({
  searchQuery,
  onSearchChange,
  sortMode,
  onSortChange,
}: {
  searchQuery: string;
  onSearchChange: (next: string) => void;
  sortMode: DiscoverSortMode;
  onSortChange: (next: DiscoverSortMode) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View style={[styles.root, { flexDirection: rowDirection }]}>
      <View style={[styles.searchField, { flexDirection: rowDirection }]}>
        <Icon name="discover" size={18} color={tennisColors.mutedForeground} />
        <TextInput
          accessibilityLabel={t("discover.searchPlaceholder")}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={t("discover.searchPlaceholder")}
          placeholderTextColor={tennisColors.mutedForeground}
          style={[styles.searchInput, { writingDirection }]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <DiscoverSortControl value={sortMode} onChange={onSortChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 8,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: tennisRadii.lg,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.primaryDark,
  },
});
