import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  discoverCompatiblePlayers,
  discoverOpenMatches,
  listOwnPreferredZoneIds,
  getOwnPlayerProfile,
  listMyMatches,
  type CompatiblePlayerCard,
  type OpenMatchCard,
} from "@tennis-lebanon/api";
import {
  DEFAULT_DISCOVER_MATCH_TOGGLES,
  type DiscoverMatchToggles,
  isInviteableHostedMatch,
  canShowJoinAction,
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
import { DiscoverTimeChip } from "../../src/components/discover/DiscoverTimeChip";
import { DiscoverSearchSortBar } from "../../src/components/discover/DiscoverSearchSortBar";
import { DiscoverHeaderShell } from "../../src/components/discover/DiscoverHeaderShell";
import { DiscoverSectionSplitter } from "../../src/components/discover/DiscoverSectionSplitter";
import { DiscoverPlayerCardRow } from "../../src/components/discover/DiscoverPlayerCardRow";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  type ScreenVirtualizedListProps,
  formStyles,
} from "../../src/components/FormUi";
import { trackDiscoverViewed } from "../../src/lib/analytics";
import { startNewMatchCreate } from "../../src/lib/create-match-guard";
import {
  loadDiscoverFilters,
  saveDiscoverFilters,
} from "../../src/lib/discovery-filters";
import { formatCompactUtcInBeirut } from "../../src/lib/beirut-time";
import {
  parseDiscoverTimeWindow,
  type DiscoverTimeWindow,
} from "../../src/lib/discover-time-window";
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
  compactJoinedLabel,
  clubNamesFromList,
  matchCardAreaLabel,
} from "../../src/lib/match-clubs";
import { opponentAvatarColor } from "../../src/lib/match-card-status";
import { matchHubLevelSummary } from "../../src/lib/match-hub-summaries";
import { openMatchCardDateTimeLabel } from "../../src/lib/open-match-card-time";

type DiscoverSegment = "players" | "matches";

export default function DiscoverScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const [chosenSegment, setChosenSegment] = useState<DiscoverSegment | null>(
    null,
  );
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

  // Arrives from a Home free-block tap.
  //
  // What is stored is which window was *dismissed*, not the window itself, so
  // the filter stays derived from the params. Holding the window in state and
  // resetting it from an effect works, but sets state during an effect for
  // something that is plainly derivable, which cascades a render and is what
  // the compiler rule objects to. Keying the dismissal also gets the behaviour
  // right for free: tapping a different block produces a different key, so a
  // fresh window shows even though the previous one was cleared.
  //
  // Deliberately not persisted: `loadDiscoverFilters` stores only the toggles,
  // and a window chosen for one evening has no business surviving the session.
  const timeParams = useLocalSearchParams<{
    freeFrom?: string;
    freeTo?: string;
    segment?: string;
  }>();

  // Derived, not synced from an effect: a caller can open Discover straight on
  // Matches, and tapping a tab afterwards wins. Setting state from an effect
  // for something this plainly derivable is what the compiler's
  // cascading-render rule objects to, and the time window above already had to
  // be rewritten the same way.
  const paramSegment: DiscoverSegment | null =
    timeParams.segment === "matches" ? "matches" : null;
  const segment: DiscoverSegment = chosenSegment ?? paramSegment ?? "players";
  const paramWindow = useMemo(
    () => parseDiscoverTimeWindow(timeParams),
    [timeParams],
  );
  const [dismissedWindowKey, setDismissedWindowKey] = useState<string | null>(
    null,
  );

  const paramWindowKey = paramWindow
    ? `${paramWindow.freeFrom}|${paramWindow.freeTo}`
    : null;
  const timeWindow: DiscoverTimeWindow | null =
    paramWindowKey && paramWindowKey !== dismissedWindowKey
      ? paramWindow
      : null;
  const filtersHydrated = !userId || hydratedForUserId === userId;

  // The player's own preferred zones, not the country's zone directory. This used
  // to be getActiveZones, so the Area filter was handed every zone in Lebanon and
  // restricting to all of them matched everyone.
  const ownZonesQuery = useQuery({
    queryKey: ["own-preferred-zone-ids", userId],
    queryFn: () => listOwnPreferredZoneIds(supabase),
    enabled: Boolean(userId),
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

    return {
      ...resolveDiscoverFiltersFromProfile({
        toggles: matchToggles,
        playIntent: profile.play_intent as PlayIntent,
        ownZoneIds: ownZonesQuery.data,
      }),
      ...(timeWindow ?? {}),
    };
  }, [matchToggles, ownProfileQuery.data, ownZonesQuery.data, timeWindow]);

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

  const activeFilterCount = useMemo(
    () => Object.values(matchToggles).filter(Boolean).length,
    [matchToggles],
  );
  const resultsSettled =
    !showListSkeleton && !activeQuery.isError && !ownProfileQuery.isError;

  /**
   * Discover's empty-room rate is the cold-start canary: at pilot density,
   * stacked filters can return nothing by construction. Recorded once per
   * settled state rather than per render, so the count means "screens a player
   * actually saw".
   */
  useEffect(() => {
    if (!resultsSettled) {
      return;
    }

    trackDiscoverViewed({
      segment,
      resultCount: resultsCount,
      filtersActive: activeFilterCount,
    });
  }, [activeFilterCount, resultsCount, resultsSettled, segment]);

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
          const preferredClubLabel = compactJoinedLabel(
            clubNamesFromList(match.preferred_clubs),
            2,
          );
          const areaLabel = matchCardAreaLabel(
            match.zones,
            i18n.resolvedLanguage ?? i18n.language,
            { compact: true },
          );
          const dateTimeLabel = openMatchCardDateTimeLabel(match);
          const joinAction = canShowJoinAction({
            matchStatus: match.status,
            requiresCreatorApproval: match.requires_creator_approval,
          });
          const joinLabel =
            joinAction === "join"
              ? t("matches.list.action.join")
              : joinAction === "request"
                ? t("matches.list.action.requestJoin")
                : undefined;
          return (
            <MatchCard
              status={match.status}
              statusLabel={t(`matches.status.${match.status}`)}
              actionLabel={joinLabel}
              actionTone="actionable"
              dateTimeLabel={dateTimeLabel}
              headline={match.creator_display_name}
              hostName={match.creator_display_name}
              hostAvatarPath={match.creator_avatar_path}
              hostAvatarColor={opponentAvatarColor(match.creator_display_name)}
              formatChip={t(`formats.${match.format}`)}
              locationChip={preferredClubLabel}
              areaChip={areaLabel}
              levelChip={matchHubLevelSummary(match, t)}
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
          <SegmentTabs
            value={segment}
            options={[
              { value: "players", label: t("discover.playersTab") },
              { value: "matches", label: t("discover.matchesTab") },
            ]}
            onChange={setChosenSegment}
          />
          <DiscoverMatchChips
            toggles={matchToggles}
            onToggle={toggleMatchFilter}
          />
          {timeWindow ? (
            <DiscoverTimeChip
              label={formatCompactUtcInBeirut(timeWindow.freeFrom)}
              onClear={() => setDismissedWindowKey(paramWindowKey)}
            />
          ) : null}
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
        <DiscoverSectionSplitter
          segment={segment}
          count={resultsCount}
          // Read off the resolved filters rather than the toggle, so the wording
          // cannot drift from what was actually sent to the RPC.
          nearbyOnly={resolvedFilters?.zoneIds !== undefined}
        />
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
