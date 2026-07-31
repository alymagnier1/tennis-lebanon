import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  discoverCompatiblePlayers,
  discoverOpenMatches,
  getActiveZones,
  type CompatiblePlayerCard,
  type OpenMatchCard,
} from "@tennis-lebanon/api";
import {
  type PlayIntent,
  widenDiscoveryZoneIds,
  widenLevelWindow,
} from "@tennis-lebanon/domain";
import {
  BottomSheet,
  ChipMultiSelect,
  EmptyState,
  MatchCard,
  PlayerCard,
  SegmentTabs,
  SheetOption,
  ToolbarRow,
} from "../../src/components/AppUi";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  type ScreenVirtualizedListProps,
  formStyles,
} from "../../src/components/FormUi";
import {
  type DiscoverSortMode,
  sortCompatiblePlayers,
} from "../../src/lib/discover-sort";
import {
  loadDiscoverFilters,
  saveDiscoverFilters,
} from "../../src/lib/discovery-filters";
import { formatUtcSlotInBeirut } from "../../src/lib/beirut-time";
import { CREATE_MATCH_ROUTE } from "../../src/lib/routes";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "../../src/lib/supabase";
import { publicPlayerLevelLabel } from "../../src/lib/player-level-label";
import { zoneLabelFromList, zoneNameFromJson } from "../../src/lib/zones";

type DiscoverSegment = "players" | "matches";
type MatchFormat = "singles" | "doubles";

function playerHint(
  player: CompatiblePlayerCard,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | undefined {
  // Discovery no longer filters on overlap, so every card states its shared
  // time explicitly: the concrete slot when we have one, otherwise a plain
  // "no shared time yet" so the difference is visible rather than implied.
  const overlapHint =
    player.overlap_starts_at && player.overlap_ends_at
      ? t("discover.overlapSlotHint", {
          slot: formatUtcSlotInBeirut(
            player.overlap_starts_at,
            player.overlap_ends_at,
          ),
        })
      : player.availability_overlap
        ? t("discover.overlapHint")
        : t("discover.noOverlapHint");

  const hints = [
    overlapHint,
    player.zone_overlap ? t("discover.zoneHint") : null,
    player.level_fit ? t("discover.levelHint") : null,
  ].filter(Boolean);
  return hints.length > 0 ? hints.join(" · ") : undefined;
}

export default function DiscoverScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const [segment, setSegment] = useState<DiscoverSegment>("players");
  const [formatSheetOpen, setFormatSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [sortMode, setSortMode] = useState<DiscoverSortMode>("recommended");
  // Rank by overlap rather than filter on it; the user can opt back in.
  const [requireOverlap, setRequireOverlap] = useState(false);
  const [levelWindow, setLevelWindow] = useState(1);
  const [widenedBanner, setWidenedBanner] = useState(false);
  const [widenedZonesBanner, setWidenedZonesBanner] = useState(false);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [useWidenedZones, setUseWidenedZones] = useState(false);
  const [format, setFormat] = useState<MatchFormat | null>(null);
  const [intent, setIntent] = useState<PlayIntent | null>(null);
  const [hydratedForUserId, setHydratedForUserId] = useState<string | null>(
    null,
  );
  const filtersHydrated = !userId || hydratedForUserId === userId;

  const zonesQuery = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  useEffect(() => {
    if (!userId) return;

    let active = true;
    void (async () => {
      const saved = await loadDiscoverFilters(userId);
      if (!active) return;

      if (saved) {
        if (saved.zoneIds) setSelectedZoneIds(saved.zoneIds);
        if (saved.useWidenedZones) setUseWidenedZones(saved.useWidenedZones);
        if (saved.requireAvailabilityOverlap !== undefined) {
          setRequireOverlap(saved.requireAvailabilityOverlap);
        }
        if (saved.levelWindow !== undefined) setLevelWindow(saved.levelWindow);
        if (saved.format !== undefined) setFormat(saved.format);
        if (saved.intent !== undefined) setIntent(saved.intent);
      }
      setHydratedForUserId(userId);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !filtersHydrated) return;
    void saveDiscoverFilters(userId, {
      zoneIds: selectedZoneIds,
      useWidenedZones,
      format,
      intent,
      requireAvailabilityOverlap: requireOverlap,
      levelWindow,
    });
  }, [
    filtersHydrated,
    format,
    intent,
    levelWindow,
    requireOverlap,
    selectedZoneIds,
    useWidenedZones,
    userId,
  ]);

  const effectiveZoneIds = useMemo(() => {
    if (useWidenedZones && zonesQuery.data?.length) {
      return widenDiscoveryZoneIds(zonesQuery.data.map((zone) => zone.id));
    }
    if (selectedZoneIds.length > 0) return selectedZoneIds;
    return undefined;
  }, [selectedZoneIds, useWidenedZones, zonesQuery.data]);

  const filters = useMemo(
    () => ({
      zoneIds: effectiveZoneIds,
      format,
      intent,
      requireAvailabilityOverlap: requireOverlap,
      levelWindow,
      horizonDays: 14,
      limit: 20,
    }),
    [effectiveZoneIds, format, intent, levelWindow, requireOverlap],
  );

  const playersQuery = useQuery({
    queryKey: ["discover-players", filters],
    queryFn: () => discoverCompatiblePlayers(supabase, filters),
    staleTime: 60_000,
    enabled: segment === "players" && filtersHydrated,
  });

  const matchesQuery = useQuery({
    queryKey: ["discover-matches", filters],
    queryFn: () => discoverOpenMatches(supabase, filters),
    staleTime: 60_000,
    enabled: segment === "matches" && filtersHydrated,
  });

  const activeQuery = segment === "players" ? playersQuery : matchesQuery;

  const sortedPlayers = useMemo(
    () => sortCompatiblePlayers(playersQuery.data ?? [], sortMode),
    [playersQuery.data, sortMode],
  );

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
    await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });
  };

  const handleWidenLevel = () => {
    setLevelWindow(widenLevelWindow(levelWindow));
    setWidenedBanner(true);
  };

  const handleWidenZones = () => {
    setUseWidenedZones(true);
    setWidenedZonesBanner(true);
  };

  const toggleZone = (zoneId: string) => {
    setUseWidenedZones(false);
    setSelectedZoneIds((current) =>
      current.includes(zoneId)
        ? current.filter((id) => id !== zoneId)
        : [...current, zoneId],
    );
  };

  const formatToolbarLabel = format
    ? t(`formats.${format}`)
    : t("discover.anyFormat");

  const hasActiveFilters =
    Boolean(intent) ||
    selectedZoneIds.length > 0 ||
    useWidenedZones ||
    !requireOverlap;

  const openFormatSheet = () => {
    setSortSheetOpen(false);
    setFilterSheetOpen(false);
    setFormatSheetOpen(true);
  };

  const openSortSheet = () => {
    setFormatSheetOpen(false);
    setFilterSheetOpen(false);
    setSortSheetOpen(true);
  };

  const openFilterSheet = () => {
    setFormatSheetOpen(false);
    setSortSheetOpen(false);
    setFilterSheetOpen(true);
  };

  const sheetFooter = (onClose: () => void) => (
    <View style={formStyles.row}>
      <View style={formStyles.flex}>
        <SecondaryButton label={t("common.cancel")} onPress={onClose} />
      </View>
      <View style={formStyles.flex}>
        <PrimaryButton label={t("discover.applyFilters")} onPress={onClose} />
      </View>
    </View>
  );

  const virtualizedList = useMemo(():
    ScreenVirtualizedListProps | undefined => {
    if (segment === "players") {
      return {
        data: sortedPlayers,
        keyExtractor: (player) => (player as CompatiblePlayerCard).user_id,
        renderItem: ({ item }) => {
          const player = item as CompatiblePlayerCard;
          return (
            <PlayerCard
              name={player.display_name}
              avatarPath={player.avatar_path}
              levelLabel={publicPlayerLevelLabel(player, t)}
              locationLabel={zoneLabelFromList(
                player.zones,
                i18n.resolvedLanguage ?? i18n.language,
              )}
              hint={playerHint(player, t)}
              onPress={() =>
                router.push({
                  pathname: "/player/[id]",
                  params: { id: player.user_id },
                })
              }
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
          return (
            <MatchCard
              title={`${t(`formats.${match.format}`)} · ${match.creator_display_name}`}
              subtitle={`${t(`skillBands.${match.min_skill}`)}–${t(`skillBands.${match.max_skill}`)}`}
              meta={`${zoneLabelFromList(match.zones, i18n.resolvedLanguage ?? i18n.language)} · ${t("discover.spotsRemaining", { count: match.capacity - match.participant_count })}`}
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
    i18n.language,
    i18n.resolvedLanguage,
    matchesQuery.data,
    segment,
    sortedPlayers,
    t,
  ]);

  return (
    <>
      <Screen
        title={t("discover.title")}
        showTitle={false}
        refreshing={activeQuery.isFetching}
        onRefresh={() => void handleRefresh()}
        virtualizedList={virtualizedList}
        fixedHeader={
          <>
            <SegmentTabs
              value={segment}
              options={[
                { value: "players", label: t("discover.playersTab") },
                { value: "matches", label: t("discover.matchesTab") },
              ]}
              onChange={setSegment}
            />
            <ToolbarRow
              items={[
                {
                  label: formatToolbarLabel,
                  onPress: openFormatSheet,
                  open: formatSheetOpen,
                  active: Boolean(format),
                },
                {
                  label: t("discover.sort"),
                  onPress: openSortSheet,
                  open: sortSheetOpen,
                  active: sortMode !== "recommended",
                },
                {
                  label: t("discover.filters"),
                  onPress: openFilterSheet,
                  open: filterSheetOpen,
                  active: hasActiveFilters,
                },
              ]}
            />
          </>
        }
      >
        {widenedBanner ? (
          <Text style={formStyles.description}>
            {t("discover.widenLevelBanner")}
          </Text>
        ) : null}

        {widenedZonesBanner ? (
          <Text style={formStyles.description}>
            {t("discover.widenZonesBanner")}
          </Text>
        ) : null}

        {activeQuery.isLoading ? (
          <ActivityIndicator accessibilityLabel={t("discover.loading")} />
        ) : null}

        {activeQuery.isError ? (
          <View>
            <Text style={formStyles.errorText}>{t("discover.error")}</Text>
            <PrimaryButton
              label={t("common.retry")}
              onPress={() => void activeQuery.refetch()}
            />
          </View>
        ) : null}

        {segment === "players" &&
        sortedPlayers.length === 0 &&
        !playersQuery.isLoading ? (
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
                  label={t("discover.widenLevel")}
                  onPress={handleWidenLevel}
                />
                <SecondaryButton
                  label={t("discover.widenZones")}
                  onPress={handleWidenZones}
                />
              </>
            }
          />
        ) : null}

        {segment === "matches" &&
        matchesQuery.data?.length === 0 &&
        !matchesQuery.isLoading ? (
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
                  label={t("discover.widenZones")}
                  onPress={handleWidenZones}
                />
              </>
            }
          />
        ) : null}
      </Screen>

      <BottomSheet
        visible={formatSheetOpen}
        title={t("discover.formatFilter")}
        onClose={() => setFormatSheetOpen(false)}
        footer={sheetFooter(() => setFormatSheetOpen(false))}
      >
        {([null, "singles", "doubles"] as const).map((value) => (
          <SheetOption
            key={value ?? "any"}
            label={value ? t(`formats.${value}`) : t("discover.anyFormat")}
            selected={format === value}
            onPress={() => setFormat(value)}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={filterSheetOpen}
        title={t("discover.filterBy")}
        onClose={() => setFilterSheetOpen(false)}
        footer={sheetFooter(() => setFilterSheetOpen(false))}
      >
        <ChipMultiSelect
          label={t("discover.zonesFilter")}
          options={(zonesQuery.data ?? []).map((zone) => ({
            value: zone.id,
            label: zoneNameFromJson(
              zone.name_i18n,
              i18n.resolvedLanguage ?? i18n.language,
            ),
          }))}
          values={
            useWidenedZones
              ? (zonesQuery.data ?? []).map((zone) => zone.id)
              : selectedZoneIds
          }
          onToggle={toggleZone}
        />

        <Text style={formStyles.summaryLabel}>
          {t("discover.intentFilter")}
        </Text>
        {([null, "social", "competitive", "either"] as const).map((value) => (
          <SheetOption
            key={value ?? "any"}
            label={value ? t(`playIntent.${value}`) : t("discover.anyIntent")}
            selected={intent === value}
            onPress={() => setIntent(value)}
          />
        ))}

        <SheetOption
          label={t("discover.requireOverlap")}
          selected={requireOverlap}
          onPress={() => setRequireOverlap((value) => !value)}
        />
      </BottomSheet>

      <BottomSheet
        visible={sortSheetOpen}
        title={t("discover.sortBy")}
        onClose={() => setSortSheetOpen(false)}
        footer={sheetFooter(() => setSortSheetOpen(false))}
      >
        {(
          [
            { value: "recommended", label: t("discover.sortRecommended") },
            { value: "level", label: t("discover.sortLevel") },
            { value: "zone", label: t("discover.sortZone") },
          ] as const
        ).map((option) => (
          <SheetOption
            key={option.value}
            label={option.label}
            selected={sortMode === option.value}
            onPress={() => setSortMode(option.value)}
          />
        ))}
      </BottomSheet>
    </>
  );
}
