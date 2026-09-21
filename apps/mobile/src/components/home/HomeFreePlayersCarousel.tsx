import { useRef } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import {
  MAX_LEVEL_WINDOW,
  resolveDiscoverFiltersFromProfile,
} from "@tennis-lebanon/domain";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { Icon } from "../Icon";
import {
  HOME_FREE_PLAYER_CARD_GAP,
  HOME_FREE_PLAYER_CARD_WIDTH,
  HOME_FREE_PLAYER_SNAP_INTERVAL,
  HOME_FREE_PLAYER_TRAILING_SLACK_PX,
  homeFreePlayerDetailLine,
  homeFreePlayerShouldAdvanceOffer,
  homeFreePlayerShouldRewindOffer,
  homeFreePlayerSnapOffsets,
} from "../../lib/home-free-players-carousel";
import { clubNamesFromList } from "../../lib/match-clubs";
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

type HomeFreePlayersCarouselProps = {
  block: FreeBlock;
  /** Past the trailing "View all" card → next time-window chip. */
  onScrollPastEnd?: () => void;
  /** Past the first card toward the leading edge → previous chip. */
  onScrollPastStart?: () => void;
};

/**
 * The people behind the busiest block.
 *
 * Cards match the nearby-player reference: a wide row with avatar beside the
 * name, area as meta, and a reserved one-line slot for bio. Clubs sit next to
 * the area when there is a bio; otherwise the slot lists every preferred club
 * so cards stay the same height. There is no in-card Create — the whole card
 * opens the profile so Home stays a browse surface. Discover still gets the
 * time window through "View all".
 *
 * Pulling past the last card (or flinging while already there) advances the
 * parent chip selection; the reverse rewind works from the first card.
 */
export function HomeFreePlayersCarousel({
  block,
  onScrollPastEnd,
  onScrollPastStart,
}: HomeFreePlayersCarouselProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { rowDirection, writingDirection } = useLayoutDirection();
  const edgeRef = useRef({ atStart: true, atEnd: false });
  const gestureStartEdgeRef = useRef({ atStart: true, atEnd: false });
  const advancedRef = useRef(false);

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
      // Same eligibility as Discover with Level/Intent/Availability off and
      // Area matching the liquidity count (viewer's own zones). A hard-coded
      // `levelWindow: 4` used to look wider than Discover's Level chip, which
      // only sorts — but View-all still opened the Matches tab, so the same
      // person looked absent. Keep the window at MAX and open Players.
      discoverCompatiblePlayers(supabase, {
        ...resolveDiscoverFiltersFromProfile({
          toggles: {
            matchLevel: false,
            matchArea: Boolean(ownZonesQuery.data?.length),
            matchAvailability: false,
          },
          playIntent: "either",
          ownZoneIds: ownZonesQuery.data,
        }),
        levelWindow: MAX_LEVEL_WINDOW,
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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const maxX = Math.max(0, contentSize.width - layoutMeasurement.width);
    edgeRef.current = {
      atStart: contentOffset.x <= 2,
      atEnd: contentOffset.x >= maxX - HOME_FREE_PLAYER_TRAILING_SLACK_PX - 2,
    };

    if (advancedRef.current) return;

    // Bounce / trailing slack past the end — do not require a prior "at end".
    if (
      onScrollPastEnd &&
      homeFreePlayerShouldAdvanceOffer({
        offsetX: contentOffset.x,
        contentWidth: contentSize.width,
        viewportWidth: layoutMeasurement.width,
        wasAtEnd: false,
        trailingSlackPx: HOME_FREE_PLAYER_TRAILING_SLACK_PX,
      })
    ) {
      advancedRef.current = true;
      onScrollPastEnd();
      return;
    }

    if (
      onScrollPastStart &&
      homeFreePlayerShouldRewindOffer({
        offsetX: contentOffset.x,
        wasAtStart: false,
      })
    ) {
      advancedRef.current = true;
      onScrollPastStart();
    }
  };

  const handleScrollBeginDrag = () => {
    gestureStartEdgeRef.current = { ...edgeRef.current };
    advancedRef.current = false;
  };

  const handleScrollEndDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (advancedRef.current) return;
    const { contentOffset, contentSize, layoutMeasurement, velocity } =
      event.nativeEvent;
    const velocityX = velocity?.x ?? 0;
    const { atStart, atEnd } = gestureStartEdgeRef.current;

    if (
      onScrollPastEnd &&
      homeFreePlayerShouldAdvanceOffer({
        offsetX: contentOffset.x,
        contentWidth: contentSize.width,
        viewportWidth: layoutMeasurement.width,
        velocityX,
        wasAtEnd: atEnd,
        trailingSlackPx: HOME_FREE_PLAYER_TRAILING_SLACK_PX,
      })
    ) {
      advancedRef.current = true;
      onScrollPastEnd();
      return;
    }

    if (
      onScrollPastStart &&
      homeFreePlayerShouldRewindOffer({
        offsetX: contentOffset.x,
        velocityX,
        wasAtStart: atStart,
      })
    ) {
      advancedRef.current = true;
      onScrollPastStart();
    }
  };

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
        bounces
        alwaysBounceHorizontal
        overScrollMode="always"
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        style={[
          styles.scroll,
          webStripSnap,
          Platform.OS === "web" ? { direction: writingDirection } : null,
        ]}
        contentContainerStyle={styles.strip}
      >
        {players.map((player) => {
          const areaLabel = firstZoneLabel(player.zones, locale);
          const detail = homeFreePlayerDetailLine({
            about: player.bio ?? "",
            clubNames: clubNamesFromList(player.favorite_clubs),
          });

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
                {detail.metaClubLabel ? (
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
                      {detail.metaClubLabel}
                    </AppText>
                  </View>
                ) : null}
              </View>

              <View
                style={[styles.detailSlot, { flexDirection: rowDirection }]}
              >
                {detail.kind === "clubs" ? (
                  <Icon
                    name="court"
                    size={13}
                    color={tennisColors.mutedForeground}
                  />
                ) : null}
                {detail.text ? (
                  <AppText
                    style={[styles.detailText, { writingDirection }]}
                    maxLines={1}
                  >
                    {detail.text}
                  </AppText>
                ) : null}
              </View>
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
              params: {
                segment: "players",
                freeFrom: block.startsAt,
                freeTo: block.endsAt,
              },
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
        {/* Slack past View all so web (no rubber-band) can keep scrolling. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.trailingSlack}
        />
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
      minHeight: 16,
    },
    metaItem: {
      alignItems: "center",
      gap: 4,
      minHeight: 16,
      maxWidth: "50%",
      flexShrink: 1,
      minWidth: 0,
    },
    metaText: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
      flexShrink: 1,
    },
    detailSlot: {
      width: "100%",
      minHeight: 16,
      alignItems: "center",
      gap: 4,
    },
    detailText: {
      flex: 1,
      minWidth: 0,
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
      color: tennisColors.violetText,
      textAlign: "center",
    },
    trailingSlack: {
      width: HOME_FREE_PLAYER_TRAILING_SLACK_PX,
    },
  }),
);
