import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  ClubsDirectoryHeader,
  useClubsDirectoryFilters,
} from "../../src/components/ClubsDirectoryHeader";
import { ClubsDirectoryList } from "../../src/components/ClubsDirectoryList";
import { AppText } from "../../src/components/AppText";
import { useClubsDirectory } from "../../src/hooks/useClubsDirectory";
import { zoneNameFromJson } from "../../src/lib/zones";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import type { ClubDirectoryRow } from "@tennis-lebanon/api";
import type { Json } from "@tennis-lebanon/types";

export default function ClubsTabScreen() {
  const { t, i18n } = useTranslation();
  const clubsQuery = useClubsDirectory();
  const clubs = clubsQuery.data ?? [];
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const zoneLabel = (club: ClubDirectoryRow) =>
    zoneNameFromJson(club.zone_name_i18n as Json, locale);

  const { search, setSearch, surface, setSurface, filtered } =
    useClubsDirectoryFilters(clubs, zoneLabel);

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={clubsQuery.isRefetching}
            onRefresh={() => void clubsQuery.refetch()}
          />
        }
      >
        <ClubsDirectoryHeader
          search={search}
          onSearchChange={setSearch}
          surface={surface}
          onSurfaceChange={setSurface}
        />

        <View style={styles.listSection}>
          {clubsQuery.isLoading ? (
            <ActivityIndicator accessibilityLabel={t("common.loading")} />
          ) : (
            <>
              <AppText style={styles.resultCount}>
                {t("clubs.resultCount", { count: filtered.length })}
              </AppText>
              <ClubsDirectoryList clubsQuery={clubsQuery} clubs={filtered} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  listSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 16,
  },
  resultCount: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
});
