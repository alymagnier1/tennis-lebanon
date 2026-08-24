import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { FigmaSubpageHero } from "./onboarding-ui";
import { useLayoutDirection } from "../lib/layout-direction";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

const SURFACE_FILTERS = ["all", "hard", "clay", "grass", "other"] as const;

export type ClubsSurfaceFilter = (typeof SURFACE_FILTERS)[number];

export function ClubsDirectoryHeader({
  search,
  onSearchChange,
  surface,
  onSurfaceChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  surface: ClubsSurfaceFilter;
  onSurfaceChange: (value: ClubsSurfaceFilter) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection, isRtl } = useLayoutDirection();

  return (
    <View>
      <FigmaSubpageHero
        title={t("clubs.directoryTitle")}
        description={t("clubs.directoryDescription")}
      >
        <View style={styles.searchWrap}>
          <View style={styles.searchIcon}>
            <Icon name="discover" size={16} color="rgba(255,255,255,0.6)" />
          </View>
          <TextInput
            accessibilityLabel={t("clubs.searchPlaceholder")}
            placeholder={t("clubs.searchPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={search}
            onChangeText={onSearchChange}
            style={[
              styles.searchInput,
              { writingDirection, textAlign: isRtl ? "right" : "left" },
            ]}
          />
        </View>
      </FigmaSubpageHero>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.filterRow,
          { flexDirection: rowDirection },
        ]}
      >
        {SURFACE_FILTERS.map((filter) => {
          const selected = surface === filter;
          return (
            <Pressable
              key={filter}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSurfaceChange(filter)}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
            >
              <AppText
                style={[
                  styles.filterChipLabel,
                  selected && styles.filterChipLabelSelected,
                ]}
              >
                {filter === "all"
                  ? t("clubs.surfaceAll")
                  : t(`clubs.surfaces.${filter}`)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
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
  const [surface, setSurface] = useState<ClubsSurfaceFilter>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clubs.filter((club) => {
      const zone = zoneLabel(club).toLowerCase();
      if (
        query &&
        !club.name.toLowerCase().includes(query) &&
        !zone.includes(query)
      ) {
        return false;
      }

      if (surface === "all") {
        return true;
      }

      const surfaceLabel = surface.toLowerCase();
      const haystack = [...club.amenities, club.name, zone]
        .join(" ")
        .toLowerCase();

      return haystack.includes(surfaceLabel);
    });
  }, [clubs, search, surface, zoneLabel]);

  return {
    search,
    setSearch,
    surface,
    setSurface,
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
      left: 14,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      zIndex: 1,
    },
    searchInput: {
      paddingVertical: 12,
      paddingLeft: 40,
      paddingRight: 12,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.2)",
      borderRadius: tennisRadii.md,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.white,
    },
    filterRow: {
      backgroundColor: tennisColors.card,
      borderBottomWidth: 1,
      borderBottomColor: tennisColors.border,
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: tennisRadii.pill,
      backgroundColor: tennisColors.muted,
    },
    filterChipSelected: {
      backgroundColor: tennisColors.primary,
    },
    filterChipLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    filterChipLabelSelected: {
      color: tennisColors.white,
    },
  }),
);
