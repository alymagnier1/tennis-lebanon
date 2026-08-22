import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  discoverCompatiblePlayers,
  listOwnPreferredZoneIds,
  type CompatiblePlayerCard,
} from "@tennis-lebanon/api";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { beginCreateMatchForPlayer } from "../../lib/begin-create-match-for-player";
import { useLayoutDirection } from "../../lib/layout-direction";
import { publicPlayerLevelChip } from "../../lib/player-level-label";
import { CREATE_MATCH_ROUTE } from "../../lib/routes";
import { skillBandColor, skillBandFill } from "../../lib/skill-band-theme";
import { supabase } from "../../lib/supabase";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/** Enough to feel like a choice, few enough that the rest is worth a tap through. */
const CARD_LIMIT = 5;

type FreeBlock = {
  startsAt: string;
  endsAt: string;
  playerCount: number;
  label: string;
};

/**
 * The people behind the busiest block, one tap from a match.
 *
 * This replaced a whole screen. `/free-block` ran the same query against the
 * same RPC with the same zone scoping and drew the same player cards as the
 * Discover tab, so it was a second discovery surface reachable only from here.
 *
 * The card's primary action carries **both halves of the decision**: the player
 * and the time. `prefillCreateMatchDraftForPlayer` reads `overlap_starts_at`,
 * and `075` computes that overlap inside the requested window, so the create
 * flow opens already knowing when. A CTA carrying only "who" would make this a
 * worse Discover rather than a shortcut past it.
 */
export function HomeFreePlayersCarousel({ block }: { block: FreeBlock }) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  const ownZonesQuery = useQuery({
    queryKey: ["own-preferred-zone-ids"],
    queryFn: () => listOwnPreferredZoneIds(supabase),
    staleTime: 60_000,
  });

  const playersQuery = useQuery({
    queryKey: [
      "home-free-players",
      block.startsAt,
      block.endsAt,
      ownZonesQuery.data,
    ],
    queryFn: () =>
      discoverCompatiblePlayers(supabase, {
        // Zone-scoped to match the count that named this block. Level is left
        // wide: the count does not filter on it either.
        zoneIds: ownZonesQuery.data?.length ? ownZonesQuery.data : undefined,
        levelWindow: 4,
        limit: CARD_LIMIT,
        freeFrom: block.startsAt,
        freeTo: block.endsAt,
      }),
    enabled: ownZonesQuery.isSuccess,
    staleTime: 60_000,
  });

  const players = playersQuery.data ?? [];

  // Nothing to scroll through, and a heading over an empty strip is worse than
  // no strip. The block list above still reports the count.
  if (players.length === 0) {
    return null;
  }

  const openProfile = (player: CompatiblePlayerCard) =>
    router.push({ pathname: "/player/[id]", params: { id: player.user_id } });

  const startMatch = (player: CompatiblePlayerCard) => {
    beginCreateMatchForPlayer(player);
    router.push(CREATE_MATCH_ROUTE);
  };

  return (
    <View style={styles.root}>
      <AppText style={[styles.heading, { writingDirection }]} maxLines={1}>
        {t("home.free.carouselTitle", { slot: block.label })}
      </AppText>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {players.map((player) => (
          <View key={player.user_id} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("discover.openPlayerProfile", {
                name: player.display_name,
              })}
              onPress={() => openProfile(player)}
              style={({ pressed }) => [
                styles.identity,
                pressed && styles.pressed,
              ]}
            >
              <Avatar
                name={player.display_name}
                avatarPath={player.avatar_path}
                size={48}
              />
              <AppText style={[styles.name, { writingDirection }]} maxLines={1}>
                {player.display_name}
              </AppText>
              <View
                style={[
                  styles.levelBadge,
                  { backgroundColor: skillBandFill(player.skill_band) },
                ]}
              >
                <AppText
                  style={[
                    styles.levelBadgeText,
                    { color: skillBandColor(player.skill_band) },
                  ]}
                  maxLines={1}
                >
                  {publicPlayerLevelChip(player, t)}
                </AppText>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("discover.createMatchWith", {
                name: player.display_name,
              })}
              onPress={() => startMatch(player)}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <AppText style={styles.ctaLabel} maxLines={1}>
                {t("matches.create.cta")}
              </AppText>
            </Pressable>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.free.seeAllInDiscover", {
            count: block.playerCount,
          })}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/discover",
              params: { freeFrom: block.startsAt, freeTo: block.endsAt },
            })
          }
          style={({ pressed }) => [
            styles.seeAll,
            { flexDirection: rowDirection },
            pressed && styles.pressed,
          ]}
        >
          <AppText style={[styles.seeAllLabel, { writingDirection }]}>
            {t("home.free.seeAllInDiscover", { count: block.playerCount })}
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  heading: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  strip: {
    gap: 8,
    paddingVertical: 2,
  },
  // Same shell as the block rows above, so the strip reads as part of the
  // section rather than a widget dropped into it.
  card: {
    width: 148,
    gap: 10,
    padding: 12,
    borderRadius: tennisRadii.md,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  identity: {
    alignItems: "center",
    gap: 6,
  },
  pressed: {
    opacity: 0.9,
  },
  name: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primaryDark,
    textAlign: "center",
  },
  levelBadge: {
    borderRadius: tennisRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  levelBadgeText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 11,
  },
  cta: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: tennisRadii.sm,
    backgroundColor: tennisColors.primary,
  },
  ctaLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.white,
  },
  seeAll: {
    width: 132,
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: tennisRadii.md,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.muted,
  },
  seeAllLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.primary,
    textAlign: "center",
  },
});
