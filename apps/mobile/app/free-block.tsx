import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAvailabilityWindow,
  discoverCompatiblePlayers,
  listMyMatches,
  listOwnAvailability,
  listOwnPreferredZoneIds,
  recordAvailabilityPing,
} from "@tennis-lebanon/api";
import { isInviteableHostedMatch } from "@tennis-lebanon/domain";
import { AppText } from "../src/components/AppText";
import { ListSkeleton } from "../src/components/AppUi";
import {
  PrimaryButton,
  Screen,
  ScreenError,
  SecondaryButton,
} from "../src/components/FormUi";
import { DiscoverPlayerCardRow } from "../src/components/discover/DiscoverPlayerCardRow";
import { trackEvent } from "../src/lib/analytics";
import {
  findSlotCoverage,
  type AvailabilityWindowLike,
} from "../src/lib/availability-ping";
import { utcIsoToBeirutFields } from "../src/lib/beirut-time";
import { weekdayIndexFromBeirutDateKey } from "../src/lib/near-term-availability";
import { availabilityDayPartFromUtcIso } from "../src/lib/player-availability-label";
import { supabase } from "../src/lib/supabase";
import { tennisColors } from "../src/theme/tennis-tokens";
import { tennisFontFamily } from "../src/hooks/useTennisFonts";

/**
 * The players free in one block, opened from "5 free" on Home.
 *
 * The count was a fact nobody could act on: Home said five players were free on
 * Friday evening and there was no way to see who. Discover cannot answer it — its
 * availability filter matches players who overlap the viewer anywhere in a
 * fortnight, which is a different question with a different answer — so a tap sent
 * there would have opened a list that disagreed with the number that offered it.
 *
 * Both sides therefore run the same rule: `p_free_from`/`p_free_to` on
 * `discover_compatible_players` apply the one-contiguous-hour test that
 * `get_availability_liquidity` counts with, and the viewer's own zones are passed
 * because the count is zone-scoped. Verified across every block: the count and the
 * length of this list are equal.
 */
export default function FreeBlockScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ startsAt?: string; endsAt?: string }>();

  const startsAt = typeof params.startsAt === "string" ? params.startsAt : "";
  const endsAt = typeof params.endsAt === "string" ? params.endsAt : "";
  const valid =
    startsAt.length > 0 &&
    endsAt.length > 0 &&
    !Number.isNaN(Date.parse(startsAt)) &&
    !Number.isNaN(Date.parse(endsAt));

  const ownZonesQuery = useQuery({
    queryKey: ["own-preferred-zone-ids"],
    queryFn: () => listOwnPreferredZoneIds(supabase),
  });

  const availabilityQuery = useQuery({
    queryKey: ["own-availability"],
    queryFn: () => listOwnAvailability(supabase),
  });

  const playersQuery = useQuery({
    queryKey: ["free-block-players", startsAt, endsAt, ownZonesQuery.data],
    queryFn: () =>
      discoverCompatiblePlayers(supabase, {
        // Zone-scoped to match the count that opened this screen. Level is left
        // wide: the count does not filter on it either.
        zoneIds: ownZonesQuery.data?.length ? ownZonesQuery.data : undefined,
        levelWindow: 4,
        limit: 50,
        freeFrom: startsAt,
        freeTo: endsAt,
      }),
    enabled: valid && ownZonesQuery.isSuccess,
  });

  const myMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });

  const inviteableMatches = useMemo(
    () => (myMatchesQuery.data ?? []).filter(isInviteableHostedMatch),
    [myMatchesQuery.data],
  );

  const windows: AvailabilityWindowLike[] = availabilityQuery.data ?? [];
  const coverage = valid
    ? findSlotCoverage(
        { startsAt, endsAt, dateKey: utcIsoToBeirutFields(startsAt).date },
        weekdayIndexFromBeirutDateKey(utcIsoToBeirutFields(startsAt).date),
        windows,
      )
    : null;

  const blockLabel = useMemo(() => {
    if (!valid) return "";
    const { date, time } = utcIsoToBeirutFields(startsAt);
    const weekday = t(
      `availability.weekdaysShort.${weekdayIndexFromBeirutDateKey(date)}`,
    );
    const part = t(
      `availability.blocks.${availabilityDayPartFromUtcIso(startsAt)}`,
    );
    return `${weekday} · ${part} · ${time}–${utcIsoToBeirutFields(endsAt).time}`;
  }, [endsAt, startsAt, t, valid]);

  async function refreshAvailability() {
    await queryClient.invalidateQueries({ queryKey: ["own-availability"] });
    await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
  }

  const addMutation = useMutation({
    mutationFn: () => recordAvailabilityPing(supabase, startsAt, endsAt),
    onSuccess: async () => {
      trackEvent("availability_ping_sent", {
        day_part: availabilityDayPartFromUtcIso(startsAt),
        surface: "free_block",
        player_count: playersQuery.data?.length ?? 0,
      });
      await refreshAvailability();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (windowId: string) =>
      deleteAvailabilityWindow(supabase, windowId),
    onSuccess: refreshAvailability,
  });

  if (!valid) {
    return (
      <Screen title={t("freeBlock.title")}>
        <ScreenError
          message={t("freeBlock.invalid")}
          retryLabel={t("common.back")}
          onRetry={() => router.back()}
        />
      </Screen>
    );
  }

  const players = playersQuery.data ?? [];
  const busy = addMutation.isPending || removeMutation.isPending;
  // A grid entry belongs to the availability screen; removing it here would
  // quietly rewrite the player's usual week.
  const removable = coverage?.kind === "one_off";

  return (
    <Screen
      title={t("freeBlock.title")}
      description={blockLabel}
      refreshing={playersQuery.isRefetching}
      onRefresh={() => void playersQuery.refetch()}
    >
      <View style={styles.selfState}>
        {coverage ? (
          <>
            <AppText style={styles.selfFree}>
              {t(
                removable
                  ? "freeBlock.youAreFree"
                  : "freeBlock.youAreFreeFromAvailability",
              )}
            </AppText>
            {removable ? (
              <SecondaryButton
                label={t("freeBlock.removeMe")}
                onPress={() => removeMutation.mutate(coverage.window.id)}
                disabled={busy}
              />
            ) : null}
          </>
        ) : (
          <PrimaryButton
            label={t("freeBlock.addMe")}
            onPress={() => addMutation.mutate()}
            disabled={busy}
          />
        )}
      </View>

      {playersQuery.isLoading ? <ListSkeleton rows={4} /> : null}

      {playersQuery.isError ? (
        <ScreenError
          message={t("discover.error")}
          retryLabel={t("common.retry")}
          onRetry={() => void playersQuery.refetch()}
        />
      ) : null}

      {!playersQuery.isLoading && !playersQuery.isError ? (
        players.length === 0 ? (
          <AppText style={styles.empty}>{t("freeBlock.empty")}</AppText>
        ) : (
          players.map((player) => (
            <DiscoverPlayerCardRow
              key={player.user_id}
              player={player}
              inviteableMatches={inviteableMatches}
              locale={i18n.resolvedLanguage ?? i18n.language}
              showOverlapAvailability={false}
            />
          ))
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  selfState: {
    gap: 8,
    marginBottom: 4,
  },
  selfFree: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primaryDark,
  },
  empty: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
});
