import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  playerMatchesViewerFormat,
  resolveDiscoverFiltersFromProfile,
  type PlayIntent,
} from "@tennis-lebanon/domain";
import { EmptyState, MatchCard, SegmentTabs } from "../../src/components/AppUi";
import { DiscoverMatchChips } from "../../src/components/discover/DiscoverMatchChips";
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
import { CREATE_MATCH_ROUTE } from "../../src/lib/routes";
import {
  loadDiscoverFilters,
  saveDiscoverFilters,
} from "../../src/lib/discovery-filters";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "../../src/lib/supabase";
import { zoneLabelFromList } from "../../src/lib/zones";
import { clubLabelFromList } from "../../src/lib/match-clubs";

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

    const { applyClientFormatMatch, ...apiFilters } =
      resolveDiscoverFiltersFromProfile({
        toggles: matchToggles,
        playIntent: profile.play_intent as PlayIntent,
        prefersSingles: profile.prefers_singles,
        prefersDoubles: profile.prefers_doubles,
        allZoneIds: zonesQuery.data?.map((zone) => zone.id),
      });

    return { apiFilters, applyClientFormatMatch };
  }, [matchToggles, ownProfileQuery.data, zonesQuery.data]);

  const playersQuery = useQuery({
    queryKey: ["discover-players", resolvedFilters?.apiFilters],
    queryFn: () =>
      discoverCompatiblePlayers(supabase, resolvedFilters?.apiFilters ?? {}),
    staleTime: 60_000,
    enabled:
      segment === "players" &&
      filtersHydrated &&
      Boolean(resolvedFilters) &&
      ownProfileQuery.isSuccess,
  });

  const matchesQuery = useQuery({
    queryKey: ["discover-matches", resolvedFilters?.apiFilters],
    queryFn: () =>
      discoverOpenMatches(supabase, resolvedFilters?.apiFilters ?? {}),
    staleTime: 60_000,
    enabled:
      segment === "matches" &&
      filtersHydrated &&
      Boolean(resolvedFilters) &&
      ownProfileQuery.isSuccess,
  });

  const filteredPlayers = useMemo(() => {
    const players = playersQuery.data ?? [];
    if (!resolvedFilters?.applyClientFormatMatch || !ownProfileQuery.data) {
      return players;
    }

    return players.filter((player) =>
      playerMatchesViewerFormat({
        viewerPrefersSingles: ownProfileQuery.data.prefers_singles,
        viewerPrefersDoubles: ownProfileQuery.data.prefers_doubles,
        candidatePrefersSingles: player.prefers_singles,
        candidatePrefersDoubles: player.prefers_doubles,
      }),
    );
  }, [
    ownProfileQuery.data,
    playersQuery.data,
    resolvedFilters?.applyClientFormatMatch,
  ]);

  const activeQuery = segment === "players" ? playersQuery : matchesQuery;
  const resultsCount =
    segment === "players"
      ? filteredPlayers.length
      : (matchesQuery.data?.length ?? 0);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
    await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });
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
      matchFormat: false,
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

  const locale = i18n.resolvedLanguage ?? i18n.language;

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
        data: matchesQuery.data ?? [],
        keyExtractor: (match) => (match as OpenMatchCard).match_id,
        renderItem: ({ item }) => {
          const match = item as OpenMatchCard;
          // A booked court beats the shortlist, which beats the zone: deciding
          // whether to drive needs the venue, and the card has room for one.
          const whereLabel =
            match.court_club_name ||
            clubLabelFromList(match.preferred_clubs) ||
            zoneLabelFromList(
              match.zones,
              i18n.resolvedLanguage ?? i18n.language,
            );
          return (
            <MatchCard
              title={`${t(`formats.${match.format}`)} · ${match.creator_display_name}`}
              subtitle={`${t(`skillBands.${match.min_skill}`)}–${t(`skillBands.${match.max_skill}`)}`}
              meta={`${whereLabel} · ${t("discover.spotsRemaining", { count: match.capacity - match.participant_count })}`}
              badge={
                match.court_secured
                  ? t("discover.courtSecuredBadge")
                  : undefined
              }
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
    matchesQuery.data,
    segment,
    t,
  ]);

  return (
    <Screen
      title={t("discover.title")}
      showTitle={false}
      refreshing={activeQuery.isFetching}
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
      {!activeQuery.isLoading &&
      !activeQuery.isError &&
      !ownProfileQuery.isLoading ? (
        <DiscoverSectionSplitter segment={segment} count={resultsCount} />
      ) : null}

      {activeQuery.isLoading || ownProfileQuery.isLoading ? (
        <ActivityIndicator accessibilityLabel={t("discover.loading")} />
      ) : null}

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
      !playersQuery.isLoading &&
      !ownProfileQuery.isLoading ? (
        <EmptyState
          title={t("discover.emptyPlayersTitle")}
          body={t("discover.emptyPlayersBody")}
          action={
            <>
              <PrimaryButton
                label={t("matches.create.organiseCta")}
                onPress={() => router.push(CREATE_MATCH_ROUTE)}
              />
              <SecondaryButton
                label={t("discover.relaxFilters")}
                onPress={relaxFilters}
              />
            </>
          }
        />
      ) : null}

      {segment === "matches" &&
      matchesQuery.data?.length === 0 &&
      !matchesQuery.isLoading &&
      !ownProfileQuery.isLoading ? (
        <EmptyState
          title={t("discover.emptyMatchesTitle")}
          body={t("discover.emptyMatchesBody")}
          action={
            <>
              <PrimaryButton
                label={t("matches.create.organiseCta")}
                onPress={() => router.push(CREATE_MATCH_ROUTE)}
              />
              <SecondaryButton
                label={t("discover.relaxFilters")}
                onPress={relaxFilters}
              />
            </>
          }
        />
      ) : null}
    </Screen>
  );
}
