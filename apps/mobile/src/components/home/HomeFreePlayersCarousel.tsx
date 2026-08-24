import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
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
import { Icon } from "../Icon";
import {
  HOME_FREE_PLAYER_CARD_GAP,
  HOME_FREE_PLAYER_CARD_WIDTH,
  HOME_FREE_PLAYER_SNAP_INTERVAL,
  homeFreePlayerSnapOffsets,
} from "../../lib/home-free-players-carousel";
import { compactJoinedLabel, clubNamesFromList } from "../../lib/match-clubs";
import { useLayoutDirection } from "../../lib/layout-direction";
import { zoneLabelFromList } from "../../lib/zones";
import { supabase } from "../../lib/supabase";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/** Enough to feel like a choice, few enough that the rest is worth a tap through. */
const CARD_LIMIT = 5;
const CARD_AVATAR = 48;

const webStripSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapType: "x mandatory" } as ViewStyle)
    : undefined;
const webItemSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapAlign: "start", scrollSnapStop: "always" } as ViewStyle)
    : undefined;

type FreeBlock = {
  startsAt: string;
  endsAt: string;
  /** For the accessibility label only; the selected chip carries it visually. */
  label: string;
};

/**
 * The people behind the busiest block.
 *
 * Cards match the nearby-player reference: a wide row with avatar beside the
 * name, area and preferred club as meta, and bio as a one-line hint. There is
 * no in-card Create — the whole card opens the profile so Home stays a browse
 * surface. Discover still gets the time window through "View all".
 */
export function HomeFreePlayersCarousel({ block }: { block: FreeBlock }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
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

  if (players.length === 0) {
    return null;
  }

  const openProfile = (player: CompatiblePlayerCard) =>
    router.push({ pathname: "/player/[id]", params: { id: player.user_id } });

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToInterval={HOME_FREE_PLAYER_SNAP_INTERVAL}
        snapToOffsets={homeFreePlayerSnapOffsets(players.length)}
        disableIntervalMomentum
        style={[
          styles.scroll,
          webStripSnap,
          Platform.OS === "web" ? { direction: writingDirection } : null,
        ]}
        contentContainerStyle={styles.strip}
      >
        {players.map((player) => {
          const areaLabel = firstZoneLabel(player.zones, locale);
          const clubLabel = compactJoinedLabel(
            clubNamesFromList(player.favorite_clubs),
          );
          const about = player.bio?.replace(/\s+/g, " ").trim() ?? "";

          return (
            <Pressable
              key={player.user_id}
              accessibilityRole="button"
              accessibilityLabel={t("discover.openPlayerProfile", {
                name: player.display_name,
              })}
              onPress={() => openProfile(player)}
              style={({ pressed }) => [
                styles.card,
                webItemSnap,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.header, { flexDirection: rowDirection }]}>
                <Avatar
                  name={player.display_name}
                  avatarPath={player.avatar_path}
                  size={CARD_AVATAR}
                />
                <View style={styles.identity}>
                  <AppText
                    style={[styles.name, { writingDirection }]}
                    maxLines={1}
                  >
                    {player.display_name}
                  </AppText>
                  <AppText
                    style={[styles.level, { writingDirection }]}
                    maxLines={1}
                  >
                    {t(`skillBandsShort.${player.skill_band}`)}
                  </AppText>
                </View>
              </View>

              <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
                {areaLabel ? (
                  <View
                    style={[styles.metaItem, { flexDirection: rowDirection }]}
                  >
                    <Icon
                      name="place"
                      size={13}
                      color={tennisColors.mutedForeground}
                    />
                    <AppText
                      style={[styles.metaText, { writingDirection }]}
                      maxLines={1}
                    >
                      {areaLabel}
                    </AppText>
                  </View>
                ) : null}
                {clubLabel ? (
                  <View
                    style={[styles.metaItem, { flexDirection: rowDirection }]}
                  >
                    <Icon
                      name="court"
                      size={13}
                      color={tennisColors.mutedForeground}
                    />
                    <AppText
                      style={[styles.metaText, { writingDirection }]}
                      maxLines={1}
                    >
                      {clubLabel}
                    </AppText>
                  </View>
                ) : null}
              </View>

              {about ? (
                <AppText
                  style={[styles.about, { writingDirection }]}
                  maxLines={1}
                >
                  {about}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.free.viewAllForSlot", {
            slot: block.label,
          })}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/discover",
              params: { freeFrom: block.startsAt, freeTo: block.endsAt },
            })
          }
          style={({ pressed }) => [
            styles.seeAll,
            webItemSnap,
            { flexDirection: rowDirection },
            pressed && styles.pressed,
          ]}
        >
          <AppText style={[styles.seeAllLabel, { writingDirection }]}>
            {t("home.free.viewAll")}
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function firstZoneLabel(zones: unknown, locale: string): string {
  const full = zoneLabelFromList(zones, locale);
  if (!full) return "";
  return full.split(" · ")[0] ?? full;
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      gap: 0,
    },
    scroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    strip: {
      gap: HOME_FREE_PLAYER_CARD_GAP,
      alignItems: "stretch",
    },
    card: {
      width: HOME_FREE_PLAYER_CARD_WIDTH,
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: tennisRadii.lg,
      borderWidth: 1,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
    },
    header: {
      alignItems: "center",
      gap: 10,
    },
    identity: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    name: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 16,
      lineHeight: 20,
      color: tennisColors.primaryDark,
    },
    level: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    metaRow: {
      alignItems: "center",
      gap: 10,
      flexWrap: "nowrap",
    },
    metaItem: {
      alignItems: "center",
      gap: 4,
      minHeight: 16,
      maxWidth: "50%",
      flexShrink: 1,
    },
    metaText: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
      flexShrink: 1,
    },
    about: {
      width: "100%",
      overflow: "hidden",
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    pressed: {
      opacity: 0.9,
    },
    seeAll: {
      width: 156,
      minHeight: minTouchTargetPx,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      borderRadius: tennisRadii.lg,
      backgroundColor: tennisColors.muted,
    },
    seeAllLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      color: tennisColors.violet,
      textAlign: "center",
    },
  }),
);
