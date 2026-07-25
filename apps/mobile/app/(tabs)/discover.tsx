import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  discoverCompatiblePlayers,
  discoverOpenMatches,
  type CompatiblePlayerCard,
  type OpenMatchCard,
} from "@tennis-lebanon/api";
import { widenLevelWindow } from "@tennis-lebanon/domain";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";
import { supabase } from "../../src/lib/supabase";

type DiscoverSegment = "players" | "matches";

function zoneLabel(
  zones: CompatiblePlayerCard["zones"] | OpenMatchCard["zones"],
  locale: string,
): string {
  if (!Array.isArray(zones) || zones.length === 0) return "";
  const first = zones[0] as { name_i18n?: Record<string, string> };
  return first.name_i18n?.[locale] ?? first.name_i18n?.en ?? "";
}

export default function DiscoverScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<DiscoverSegment>("players");
  const [requireOverlap, setRequireOverlap] = useState(true);
  const [levelWindow, setLevelWindow] = useState(1);
  const [widenedBanner, setWidenedBanner] = useState(false);

  const filters = useMemo(
    () => ({
      requireAvailabilityOverlap: requireOverlap,
      levelWindow,
      horizonDays: 14,
      limit: 20,
    }),
    [levelWindow, requireOverlap],
  );

  const playersQuery = useQuery({
    queryKey: ["discover-players", filters],
    queryFn: () => discoverCompatiblePlayers(supabase, filters),
    staleTime: 60_000,
    enabled: segment === "players",
  });

  const matchesQuery = useQuery({
    queryKey: ["discover-matches", filters],
    queryFn: () => discoverOpenMatches(supabase, filters),
    staleTime: 60_000,
    enabled: segment === "matches",
  });

  const activeQuery = segment === "players" ? playersQuery : matchesQuery;

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
    await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });
  };

  const handleWidenLevel = () => {
    setLevelWindow(widenLevelWindow(levelWindow));
    setWidenedBanner(true);
  };

  return (
    <Screen
      title={t("discover.title")}
      description={t("discover.description")}
      refreshing={activeQuery.isFetching}
      onRefresh={() => void handleRefresh()}
    >
      <View style={formStyles.segmentRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: segment === "players" }}
          onPress={() => setSegment("players")}
          style={[
            formStyles.segmentButton,
            segment === "players" && formStyles.segmentButtonActive,
          ]}
        >
          <Text style={formStyles.segmentButtonText}>
            {t("discover.playersTab")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: segment === "matches" }}
          onPress={() => setSegment("matches")}
          style={[
            formStyles.segmentButton,
            segment === "matches" && formStyles.segmentButtonActive,
          ]}
        >
          <Text style={formStyles.segmentButtonText}>
            {t("discover.matchesTab")}
          </Text>
        </Pressable>
      </View>

      <View style={formStyles.summary}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: requireOverlap }}
          onPress={() => setRequireOverlap((value) => !value)}
        >
          <Text style={formStyles.summaryValue}>
            {t("discover.requireOverlap")}: {requireOverlap ? "✓" : "—"}
          </Text>
        </Pressable>
      </View>

      {widenedBanner ? (
        <Text style={formStyles.description}>
          {t("discover.widenLevelBanner")}
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
      playersQuery.data?.length === 0 &&
      !playersQuery.isLoading ? (
        <View>
          <Text style={formStyles.title}>
            {t("discover.emptyPlayersTitle")}
          </Text>
          <Text style={formStyles.description}>
            {t("discover.emptyPlayersBody")}
          </Text>
          <SecondaryButton
            label={t("discover.widenLevel")}
            onPress={handleWidenLevel}
          />
          <SecondaryButton
            label={t("discover.toggleOverlap")}
            onPress={() => setRequireOverlap(false)}
          />
          <SecondaryButton
            label={t("discover.createMatchSoon")}
            onPress={() => undefined}
          />
        </View>
      ) : null}

      {segment === "matches" &&
      matchesQuery.data?.length === 0 &&
      !matchesQuery.isLoading ? (
        <View>
          <Text style={formStyles.title}>
            {t("discover.emptyMatchesTitle")}
          </Text>
          <Text style={formStyles.description}>
            {t("discover.emptyMatchesBody")}
          </Text>
          <SecondaryButton
            label={t("discover.createMatchSoon")}
            onPress={() => undefined}
          />
        </View>
      ) : null}

      {segment === "players"
        ? playersQuery.data?.map((player) => (
            <Pressable
              key={player.user_id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/player/[id]",
                  params: { id: player.user_id },
                })
              }
              style={formStyles.card}
            >
              <Text style={formStyles.summaryLabel}>{player.display_name}</Text>
              <Text style={formStyles.summaryValue}>
                {t(`skillBands.${player.skill_band}`)} ·{" "}
                {zoneLabel(player.zones, i18n.language)}
              </Text>
              <Text style={formStyles.hintText}>
                {[
                  player.availability_overlap
                    ? t("discover.overlapHint")
                    : null,
                  player.zone_overlap ? t("discover.zoneHint") : null,
                  player.level_fit ? t("discover.levelHint") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Pressable>
          ))
        : null}

      {segment === "matches"
        ? matchesQuery.data?.map((match) => (
            <View key={match.match_id} style={formStyles.card}>
              <Text style={formStyles.summaryLabel}>
                {t(`formats.${match.format}`)} · {match.creator_display_name}
              </Text>
              <Text style={formStyles.summaryValue}>
                {t(`skillBands.${match.min_skill}`)}–
                {t(`skillBands.${match.max_skill}`)} ·{" "}
                {zoneLabel(match.zones, i18n.language)}
              </Text>
              <Text style={formStyles.hintText}>
                {t("discover.spotsRemaining", {
                  count: match.capacity - match.participant_count,
                })}
              </Text>
            </View>
          ))
        : null}
    </Screen>
  );
}
