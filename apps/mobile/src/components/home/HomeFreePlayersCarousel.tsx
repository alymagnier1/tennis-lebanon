import { useRef, useState } from "react";
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
import { type CompatiblePlayerCard } from "@tennis-lebanon/api";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { Icon } from "../Icon";
import {
  HOME_FREE_PLAYER_CARD_GAP,
  HOME_FREE_PLAYER_CARD_WIDTH,
  HOME_FREE_PLAYER_LEADING_SLACK_PX,
  HOME_FREE_PLAYER_TRAILING_SLACK_PX,
  homeFreePlayerDetailLine,
  homeFreePlayerShouldAdvanceOffer,
  homeFreePlayerShouldRewindOffer,
  homeFreePlayerSnapOffsets,
} from "../../lib/home-free-players-carousel";
import { clubNamesFromList } from "../../lib/match-clubs";
import { shortPlayerName } from "../../lib/home-v5";
import { useLayoutDirection } from "../../lib/layout-direction";
import { useScreenReaderEnabled } from "../../hooks/useScreenReaderEnabled";
import { SnapStrip, type SnapStripRelease } from "../SnapStrip";
import { zoneLabelFromList } from "../../lib/zones";
import {
  homeFreePlayersQueryOptions,
  ownPreferredZoneIdsQueryOptions,
} from "../../lib/home-free-players-query";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

const CARD_AVATAR = 48;
const TILE_V5_AVATAR = 68;

const webStripSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapType: "x mandatory" } as ViewStyle)
    : undefined;
const webItemSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapAlign: "start", scrollSnapStop: "always" } as ViewStyle)
    : undefined;
/** View all rests flush with the viewport end, short of the trailing slack. */
const webEndItemSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapAlign: "end", scrollSnapStop: "always" } as ViewStyle)
    : undefined;

type FreeBlock = {
  startsAt: string;
  endsAt: string;
  /** For the accessibility label only; the selected chip carries it visually. */
  label: string;
};

export type HomeFreePlayersLayout = "classic" | "v5";

type HomeFreePlayersCarouselProps = {
  block: FreeBlock;
  layout?: HomeFreePlayersLayout;
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
  layout = "classic",
  onScrollPastEnd,
  onScrollPastStart,
}: HomeFreePlayersCarouselProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { rowDirection, writingDirection, isRtl } = useLayoutDirection();
  const scrollRef = useRef<ScrollView>(null);
  const edgeRef = useRef({ atStart: true, atEnd: false });
  const gestureStartEdgeRef = useRef({ atStart: true, atEnd: false });
  const advancedRef = useRef(false);
  const positionedRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [stripWidth, setStripWidth] = useState(0);
  // Arabic keeps the original edge (bounce and fling rewind only): a mirrored
  // strip has not been checked on a device.
  const leadingSlack = isRtl ? 0 : HOME_FREE_PLAYER_LEADING_SLACK_PX;
  const screenReaderEnabled = useScreenReaderEnabled();
  // A screen reader must be able to scroll a focused card into view, and the
  // mirrored strip is unverified, so both keep the ScrollView.
  const useSnapStrip =
    Platform.OS === "android" && !isRtl && !screenReaderEnabled;

  const ownZonesQuery = useQuery(ownPreferredZoneIdsQueryOptions);

  const playersQuery = useQuery({
    ...homeFreePlayersQueryOptions(block, ownZonesQuery.data),
    enabled: ownZonesQuery.isSuccess,
  });

  const players = playersQuery.data ?? [];

  // Hold the cards' space while they load: rendering nothing collapsed the
  // section and moved everything below up, then back down (2026-09-27).
  if (playersQuery.isPending && !ownZonesQuery.isError) {
    return <HomeFreePlayersSkeleton layout={layout} />;
  }

  if (players.length === 0) {
    return null;
  }

  const openProfile = (player: CompatiblePlayerCard) =>
    router.push({ pathname: "/player/[id]", params: { id: player.user_id } });

  const restingEndX =
    stripWidth > 0 && viewportWidth > 0
      ? Math.max(
          leadingSlack,
          stripWidth - viewportWidth - HOME_FREE_PLAYER_TRAILING_SLACK_PX,
        )
      : undefined;

  const positionPastLeadingSlack = () => {
    if (positionedRef.current) return;
    positionedRef.current = true;
    if (leadingSlack > 0) {
      scrollRef.current?.scrollTo({ x: leadingSlack, y: 0, animated: false });
    }
  };

  /** Released inside either slack without switching windows: ease back. */
  const settleIntoRestingRange = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (advancedRef.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const end = Math.max(
      leadingSlack,
      contentSize.width -
        layoutMeasurement.width -
        HOME_FREE_PLAYER_TRAILING_SLACK_PX,
    );
    const x = contentOffset.x;
    if (leadingSlack > 0 && x < leadingSlack - 1) {
      scrollRef.current?.scrollTo({ x: leadingSlack, y: 0, animated: true });
    } else if (x > end + 1) {
      scrollRef.current?.scrollTo({ x: end, y: 0, animated: true });
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const maxX = Math.max(0, contentSize.width - layoutMeasurement.width);
    edgeRef.current = {
      atStart: contentOffset.x <= leadingSlack + 2,
      atEnd: contentOffset.x >= maxX - HOME_FREE_PLAYER_TRAILING_SLACK_PX - 2,
    };

    // Until the strip has been moved past the leading slack, an offset of 0
    // is just the initial layout, not a pull.
    if (advancedRef.current || !positionedRef.current) return;

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
        leadingSlackPx: leadingSlack,
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
        leadingSlackPx: leadingSlack,
      })
    ) {
      advancedRef.current = true;
      onScrollPastStart();
      return;
    }

    settleIntoRestingRange(event);
  };

  const items = (
    <>
      {players.map((player) => {
        if (layout === "v5") {
          return (
            <FreePlayerTileV5
              key={player.user_id}
              player={player}
              locale={locale}
              onPress={() => openProfile(player)}
            />
          );
        }
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

            <View style={[styles.detailSlot, { flexDirection: rowDirection }]}>
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
          layout === "v5" && styles.seeAllV5,
          webEndItemSnap,
          { flexDirection: rowDirection },
          pressed && styles.pressed,
        ]}
      >
        <AppText style={[styles.seeAllLabel, { writingDirection }]}>
          {t("home.free.viewAll")}
        </AppText>
      </Pressable>
    </>
  );

  /**
   * Android, left to right, screen reader off: the strip settles itself (see
   * `SnapStrip`). React Native's own snapping stops dead on a fast swipe.
   */
  const handleStripRelease = (release: SnapStripRelease): boolean => {
    const lastIndex = release.offsets.length - 1;
    if (
      onScrollPastEnd &&
      homeFreePlayerShouldAdvanceOffer({
        offsetX: release.position,
        contentWidth: release.contentWidth,
        viewportWidth: release.viewportWidth,
        velocityX: release.velocity,
        wasAtEnd: release.startIndex === lastIndex,
      })
    ) {
      onScrollPastEnd();
      return true;
    }
    if (
      onScrollPastStart &&
      homeFreePlayerShouldRewindOffer({
        offsetX: release.position,
        velocityX: release.velocity,
        wasAtStart: release.startIndex === 0,
      })
    ) {
      onScrollPastStart();
      return true;
    }
    return false;
  };

  if (useSnapStrip) {
    return (
      <View style={styles.root}>
        <SnapStrip
          offsetsFor={(contentWidth, viewportWidth) =>
            homeFreePlayerSnapOffsets(players.length, {
              maxOffsetX: Math.max(0, contentWidth - viewportWidth),
            })
          }
          onRelease={handleStripRelease}
          contentStyle={styles.strip}
        >
          {items}
        </SnapStrip>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToOffsets={homeFreePlayerSnapOffsets(players.length, {
          leadingSlackPx: leadingSlack,
          maxOffsetX: restingEndX,
        })}
        // The slack at either end is room to pull into, never a resting spot.
        snapToStart={leadingSlack === 0}
        snapToEnd={false}
        contentOffset={{ x: leadingSlack, y: 0 }}
        disableIntervalMomentum
        bounces
        alwaysBounceHorizontal
        overScrollMode="always"
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width !== viewportWidth) setViewportWidth(width);
        }}
        onContentSizeChange={(width) => {
          if (width !== stripWidth) setStripWidth(width);
          positionPastLeadingSlack();
        }}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={settleIntoRestingRange}
        scrollEventThrottle={16}
        style={[
          styles.scroll,
          webStripSnap,
          Platform.OS === "web" ? { direction: writingDirection } : null,
        ]}
        contentContainerStyle={[styles.strip, { paddingStart: leadingSlack }]}
      >
        {items}

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

/**
 * Two placeholder cards with the real card's layout and text styles, so the
 * real cards replace them without the section changing height.
 */
export function HomeFreePlayersSkeleton({
  layout = "classic",
}: {
  layout?: HomeFreePlayersLayout;
} = {}) {
  const { rowDirection } = useLayoutDirection();
  const tileV5 = (key: number) => (
    <View key={key} style={styles.tileV5}>
      <View style={[styles.whoV5, { flexDirection: rowDirection }]}>
        <View style={[styles.skeletonAvatar, styles.skeletonAvatarV5]} />
        <View style={styles.identity}>
          <AppText style={[styles.nameV5, styles.skeletonBar, { width: 110 }]}>
            {" "}
          </AppText>
          <AppText style={[styles.levelV5, styles.skeletonBar, { width: 90 }]}>
            {" "}
          </AppText>
        </View>
      </View>
      <AppText
        style={[
          styles.factV5,
          styles.skeletonBar,
          styles.firstFactV5,
          { width: 120 },
        ]}
      >
        {" "}
      </AppText>
      <AppText style={[styles.factV5, styles.skeletonBar, { width: 200 }]}>
        {" "}
      </AppText>
    </View>
  );
  const card = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.identity}>
          <AppText style={[styles.name, styles.skeletonBar, { width: 120 }]}>
            {" "}
          </AppText>
          <AppText style={[styles.level, styles.skeletonBar, { width: 72 }]}>
            {" "}
          </AppText>
        </View>
      </View>
      <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
        <AppText style={[styles.metaText, styles.skeletonBar, { width: 140 }]}>
          {" "}
        </AppText>
      </View>
      <View style={[styles.detailSlot, { flexDirection: rowDirection }]}>
        <AppText style={[styles.detailText, styles.skeletonBar]}>{" "}</AppText>
      </View>
    </View>
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.root,
        styles.skeletonStrip,
        { flexDirection: rowDirection },
      ]}
    >
      {layout === "v5" ? [tileV5(0), tileV5(1)] : [card(0), card(1)]}
    </View>
  );
}

/**
 * Home v5 tile: a big face beside first name and initial, then the area and
 * every preferred club on their own lines. No free-time line — the day tabs
 * above already say when.
 */
function FreePlayerTileV5({
  player,
  locale,
  onPress,
}: {
  player: CompatiblePlayerCard;
  locale: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const name = shortPlayerName(player.display_name);
  const level = t(`skillBands.${player.skill_band}`);
  const areaLabel = firstZoneLabel(player.zones, locale);
  const clubs = clubNamesFromList(player.favorite_clubs);
  const clubsLabel = clubs.join(" · ");
  const a11yLabel = [
    name,
    level,
    areaLabel,
    clubs.length > 0 ? clubs.join(", ") : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t("discover.openPlayerProfile", { name })}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tileV5,
        webItemSnap,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.whoV5, { flexDirection: rowDirection }]}>
        <Avatar
          name={player.display_name}
          avatarPath={player.avatar_path}
          size={TILE_V5_AVATAR}
        />
        <View style={styles.identity}>
          <AppText style={[styles.nameV5, { writingDirection }]} maxLines={1}>
            {name}
          </AppText>
          <AppText style={[styles.levelV5, { writingDirection }]} maxLines={1}>
            {level}
          </AppText>
        </View>
      </View>
      {areaLabel ? (
        <View
          style={[
            styles.factRowV5,
            styles.firstFactV5,
            { flexDirection: rowDirection },
          ]}
        >
          <Icon name="place" size={18} color={tennisColors.mutedForeground} />
          <AppText style={[styles.factV5, { writingDirection }]} maxLines={1}>
            {areaLabel}
          </AppText>
        </View>
      ) : null}
      {clubsLabel ? (
        <View
          style={[
            styles.factRowV5,
            !areaLabel && styles.firstFactV5,
            { flexDirection: rowDirection },
          ]}
        >
          <Icon name="court" size={18} color={tennisColors.mutedForeground} />
          <AppText style={[styles.factV5, { writingDirection }]} maxLines={1}>
            {clubsLabel}
          </AppText>
        </View>
      ) : null}
    </Pressable>
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
    skeletonStrip: {
      gap: HOME_FREE_PLAYER_CARD_GAP,
      overflow: "hidden",
    },
    skeletonAvatar: {
      width: CARD_AVATAR,
      height: CARD_AVATAR,
      borderRadius: CARD_AVATAR / 2,
      backgroundColor: tennisColors.muted,
    },
    // Same text styles as the card, so each bar is exactly one line high.
    skeletonBar: {
      alignSelf: "flex-start",
      borderRadius: 4,
      backgroundColor: tennisColors.muted,
      color: "transparent",
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
    seeAllV5: {
      borderRadius: 22,
    },
    skeletonAvatarV5: {
      width: TILE_V5_AVATAR,
      height: TILE_V5_AVATAR,
      borderRadius: TILE_V5_AVATAR / 2,
    },
    tileV5: {
      width: HOME_FREE_PLAYER_CARD_WIDTH,
      paddingTop: 18,
      paddingHorizontal: 18,
      paddingBottom: 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
      shadowColor: "#0C382E",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    whoV5: {
      alignItems: "center",
      gap: 14,
    },
    nameV5: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 20,
      lineHeight: 26,
      color: tennisColors.primaryDark,
    },
    levelV5: {
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
    factRowV5: {
      alignItems: "center",
      gap: 6,
      marginTop: 4,
      minWidth: 0,
    },
    firstFactV5: {
      marginTop: 14,
    },
    factV5: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
  }),
);
