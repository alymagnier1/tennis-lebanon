import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { FigmaSubpageHero } from "./onboarding-ui";
import { filterClubsDirectory } from "../lib/clubs-directory-filters";
import { useLayoutDirection } from "../lib/layout-direction";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

export function ClubsDirectoryHeader({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { writingDirection, isRtl } = useLayoutDirection();

  return (
    <View>
      <FigmaSubpageHero
        title={t("clubs.directoryTitle")}
        description={t("clubs.directoryDescription")}
      >
        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchIcon,
              isRtl ? styles.searchIconRtl : styles.searchIconLtr,
            ]}
          >
            <Icon
              name="discover"
              size={16}
              color={tennisColors.mutedForeground}
            />
          </View>
          <TextInput
            accessibilityLabel={t("clubs.searchPlaceholder")}
            placeholder={t("clubs.searchPlaceholder")}
            placeholderTextColor={tennisColors.mutedForeground}
            value={search}
            onChangeText={onSearchChange}
            style={[
              styles.searchInput,
              isRtl ? styles.searchInputRtl : styles.searchInputLtr,
              { writingDirection, textAlign: isRtl ? "right" : "left" },
            ]}
          />
        </View>
      </FigmaSubpageHero>
    </View>
  );
}

export function useClubsDirectoryFilters<
  T extends {
    name: string;
    zone_name_i18n: Record<string, string> | null;
    amenities: string[];
  },
>(clubs: T[], zoneLabel: (club: T) => string) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => filterClubsDirectory(clubs, search, zoneLabel),
    [clubs, search, zoneLabel],
  );

  return {
    search,
    setSearch,
    filtered,
  };
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    searchWrap: {
      position: "relative",
      marginTop: 4,
    },
    searchIcon: {
      position: "absolute",
      top: 0,
      bottom: 0,
      justifyContent: "center",
      zIndex: 1,
    },
    searchIconLtr: {
      left: 14,
    },
    searchIconRtl: {
      right: 14,
    },
    searchInput: {
      paddingVertical: 12,
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.md,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.primaryDark,
    },
    searchInputLtr: {
      paddingLeft: 40,
      paddingRight: 12,
    },
    searchInputRtl: {
      paddingRight: 40,
      paddingLeft: 12,
    },
  }),
);
