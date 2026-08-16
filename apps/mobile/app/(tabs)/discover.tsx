import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  discoverCompatiblePlayers,
  discoverOpenMatches,
  getActiveZones,
  getOwnPlayerProfile,
  listMyMatches,
  type CompatiblePlayerCard,
  type OpenMatchCard,
} from "@tennis-lebanon/api";
import {
  DEFAULT_DISCOVER_MATCH_TOGGLES,
  type DiscoverMatchToggles,
  isInviteableHostedMatch,
  resolveDiscoverFiltersFromProfile,
  type PlayIntent,
} from "@tennis-lebanon/domain";
import {
  EmptyState,
  ListSkeleton,
  MatchCard,
  SegmentTabs,
} from "../../src/components/AppUi";
import { DiscoverMatchChips } from "../../src/components/discover/DiscoverMatchChips";
import { DiscoverSearchSortBar } from "../../src/components/discover/DiscoverSearchSortBar";
import { DiscoverHeaderShell } from "../../src/components/discover/DiscoverHeaderShell";
import { DiscoverSectionSplitter } from "../../src/components/discover/DiscoverSectionSplitter";
import { DiscoverPlayerCardRow } from "../../src/components/discover/DiscoverPlayerCardRow";
import { TabPageHeader } from "../../src/components/TabPageHeader";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  type ScreenVirtualizedListProps,
  formStyles,
} from "../../src/components/FormUi";
import { startNewMatchCreate } from "../../src/lib/create-match-guard";
import {
  loadDiscoverFilters,
  saveDiscoverFilters,
} from "../../src/lib/discovery-filters";
import {
  filterDiscoverMatchesBySearch,
  filterDiscoverPlayersBySearch,
} from "../../src/lib/discover-search";
import {
  DEFAULT_DISCOVER_SORT,
  type DiscoverSortMode,
  sortDiscoverMatches,
  sortDiscoverPlayers,
} from "../../src/lib/discover-sort";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "../../src/lib/supabase";
import {
  matchCardAreaLabel,
  matchCardClubLabel,
} from "../../src/lib/match-clubs";
import { opponentAvatarColor } from "../../src/lib/match-card-status";
import { openMatchCardDateTimeLabel } from "../../src/lib/open-match-card-time";

type DiscoverSegment = "players" | "matches";

export default function DiscoverScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const [segment, setSegment] = useState<DiscoverSegment>("players");
  const [matchToggles, setMatchToggles] = useState<DiscoverMatchToggles>({
    ...DEFAULT_DISCOVER_MATCH_TOGGLES,
  });
  const [hydratedForUserId, setHydratedForUserId] = useState<string | null>(
    null,
  );
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<DiscoverSortMode>(
    DEFAULT_DISCOVER_SORT,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const filtersHydrated = !userId || hydratedForUserId === userId;

  const zonesQuery = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const ownProfileQuery = useQuery({
    queryKey: ["own-player-profile", userId],
    queryFn: () => getOwnPlayerProfile(supabase),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) return;

    let active = true;
    void (async () => {
      const saved = await loadDiscoverFilters(userId);
      if (!active) return;
      setMatchToggles(saved);
      setHydratedForUserId(userId);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !filtersHydrated) return;
    void saveDiscoverFilters(userId, matchToggles);
  }, [filtersHydrated, matchToggles, userId]);

  const resolvedFilters = useMemo(() => {
    const profile = ownProfileQuery.data;
    if (!profile) {
      return null;
    }

    return resolveDiscoverFiltersFromProfile({
      toggles: matchToggles,
      playIntent: profile.play_intent as PlayIntent,
      allZoneIds: zonesQuery.data?.map((zone) => zone.id),
    });
  }, [matchToggles, ownProfileQuery.data, zonesQuery.data]);

  const playersQuery = useQuery({
    queryKey: ["discover-players", resolvedFilters],
    queryFn: () => discoverCompatiblePlayers(supabase, resolvedFilters ?? {}),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled:
      segment === "players" &&
      filtersHydrated &&
      Boolean(resolvedFilters) &&
      ownProfileQuery.isSuccess,
  });

  const matchesQuery = useQuery({
    queryKey: ["discover-matches", resolvedFilters],
    queryFn: () => discoverOpenMatches(supabase, resolvedFilters ?? {}),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled:
      segment === "matches" &&
      filtersHydrated &&
      Boolean(resolvedFilters) &&
      ownProfileQuery.isSuccess,
  });

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const hasSearch = searchQuery.trim().length > 0;

  const filteredPlayers = useMemo(
    () =>
      sortDiscoverPlayers(
        filterDiscoverPlayersBySearch(playersQuery.data ?? [], searchQuery),
        sortMode,
        ownProfileQuery.data?.skill_band,
      ),
    [
      ownProfileQuery.data?.skill_band,
      playersQuery.data,
      searchQuery,
      sortMode,
    ],
  );

  const sortedMatches = useMemo(
    () =>
      sortDiscoverMatches(
        filterDiscoverMatchesBySearch(
          matchesQuery.data ?? [],
          searchQuery,
          locale,
        ),
        sortMode,
      ),
    [locale, matchesQuery.data, searchQuery, sortMode],
  );

  const activeQuery = segment === "players" ? playersQuery : matchesQuery;
  const resultsCount =
    segment === "players" ? filteredPlayers.length : sortedMatches.length;
  // First paint only — filter toggles keep previous rows via placeholderData.
  const showListSkeleton =
    (activeQuery.isPending && !activeQuery.isPlaceholderData) ||
    ownProfileQuery.isLoading;

  const handleRefresh = async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
        queryClient.invalidateQueries({ queryKey: ["discover-matches"] }),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  };

  const toggleMatchFilter = (key: keyof DiscoverMatchToggles) => {
    setMatchToggles((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const relaxFilters = () => {
    setMatchToggles({
      matchLevel: false,
      matchIntent: false,
      matchArea: false,
      matchAvailability: false,
    });
  };

  const inviteableMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
    enabled: segment === "players",
  });

  const inviteableMatches = useMemo(
    () => (inviteableMatchesQuery.data ?? []).filter(isInviteableHostedMatch),
    [inviteableMatchesQuery.data],
  );

  const virtualizedList = useMemo(():
    ScreenVirtualizedListProps | undefined => {
    if (segment === "players") {
      return {
        data: filteredPlayers,
        keyExtractor: (player) => (player as CompatiblePlayerCard).user_id,
        renderItem: ({ item }) => {
          const player = item as CompatiblePlayerCard;
          return (
            <DiscoverPlayerCardRow
              player={player}
              inviteableMatches={inviteableMatches}
              locale={locale}
              showOverlapAvailability={matchToggles.matchAvailability}
            />
          );
        },
      };
    }

    if (segment === "matches") {
      return {
        data: sortedMatches,
        keyExtractor: (match) => (match as OpenMatchCard).match_id,
        renderItem: ({ item }) => {
          const match = item as OpenMatchCard;
          const clubLabel = matchCardClubLabel({
            clubName: match.court_club_name,
            preferredClubs: match.preferred_clubs,
            compact: true,
          });
          const areaLabel = matchCardAreaLabel(
            match.zones,
            i18n.resolvedLanguage ?? i18n.language,
            { compact: true },
          );
          const dateTimeLabel = openMatchCardDateTimeLabel(match);
          return (
            <MatchCard
              status={match.status}
              statusLabel={t(`matches.status.${match.status}`)}
              dateTimeLabel={dateTimeLabel}
              headline={match.creator_display_name}
              hostName={match.creator_display_name}
              hostAvatarPath={match.creator_avatar_path}
              hostAvatarColor={opponentAvatarColor(match.creator_display_name)}
              formatChip={t(`formats.${match.format}`)}
              locationChip={clubLabel}
              areaChip={areaLabel}
              note={match.notes ?? undefined}
              onPress={() =>
                router.push({
                  pathname: "/match/[id]",
                  params: { id: match.match_id },
                })
              }
            />
          );
        },
      };
    }

    return undefined;
  }, [
    filteredPlayers,
    inviteableMatches,
    locale,
    matchToggles.matchAvailability,
    sortedMatches,
    segment,
    t,
    i18n.resolvedLanguage,
    i18n.language,
  ]);

  return (
    <Screen
      title={t("discover.title")}
      showTitle={false}
      refreshing={pullRefreshing}
      onRefresh={() => void handleRefresh()}
      virtualizedList={virtualizedList}
      fixedHeader={
        <DiscoverHeaderShell>
          <TabPageHeader title={t("discover.title")} />
          <SegmentTabs
            value={segment}
            options={[
              { value: "players", label: t("discover.playersTab") },
              { value: "matches", label: t("discover.matchesTab") },
            ]}
            onChange={setSegment}
          />
          <DiscoverMatchChips
            toggles={matchToggles}
            onToggle={toggleMatchFilter}
          />
        </DiscoverHeaderShell>
      }
    >
      <View style={styles.resultsToolbar}>
        <DiscoverSearchSortBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortMode={sortMode}
          onSortChange={setSortMode}
        />
      </View>

      {!showListSkeleton && !activeQuery.isError && !ownProfileQuery.isError ? (
        <DiscoverSectionSplitter segment={segment} count={resultsCount} />
      ) : null}

      {showListSkeleton ? <ListSkeleton rows={4} /> : null}

      {activeQuery.isError || ownProfileQuery.isError ? (
        <View>
          <Text style={formStyles.errorText}>{t("discover.error")}</Text>
          <PrimaryButton
            label={t("common.retry")}
            onPress={() => void activeQuery.refetch()}
          />
        </View>
      ) : null}

      {segment === "players" &&
      filteredPlayers.length === 0 &&
      !showListSkeleton &&
      !playersQuery.isFetching ? (
        <EmptyState
          title={
            hasSearch
              ? t("discover.searchEmptyTitle")
              : t("discover.emptyPlayersTitle")
          }
          body={
            hasSearch
              ? t("discover.searchEmptyBody")
              : t("discover.emptyPlayersBody")
          }
          action={
            hasSearch ? (
              <SecondaryButton
                label={t("discover.clearSearch")}
                onPress={() => setSearchQuery("")}
              />
            ) : (
              <>
                <PrimaryButton
                  label={t("matches.create.organiseCta")}
                  onPress={() => startNewMatchCreate()}
                />
                <SecondaryButton
                  label={t("discover.relaxFilters")}
                  onPress={relaxFilters}
                />
              </>
            )
          }
        />
      ) : null}

      {segment === "matches" &&
      sortedMatches.length === 0 &&
      !showListSkeleton &&
      !matchesQuery.isFetching ? (
        <EmptyState
          title={
            hasSearch
              ? t("discover.searchEmptyTitle")
              : t("discover.emptyMatchesTitle")
          }
          body={
            hasSearch
              ? t("discover.searchEmptyBody")
              : t("discover.emptyMatchesBody")
          }
          action={
            hasSearch ? (
              <SecondaryButton
                label={t("discover.clearSearch")}
                onPress={() => setSearchQuery("")}
              />
            ) : (
              <>
                <PrimaryButton
                  label={t("matches.create.organiseCta")}
                  onPress={() => startNewMatchCreate()}
                />
                <SecondaryButton
                  label={t("discover.relaxFilters")}
                  onPress={relaxFilters}
                />
              </>
            )
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  resultsToolbar: {
    marginBottom: 4,
  },
});
