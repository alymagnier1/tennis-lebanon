import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "../AppText";
import { ScreenError } from "../FormUi";
import { SlideIn } from "../SlideIn";
import { HomeFreePlayersCarousel } from "./HomeFreePlayersCarousel";
import { trackLiquiditySignalViewed } from "../../lib/analytics";
import { peakLiquidity } from "../../lib/availability-liquidity";
import { type PingSlot } from "../../lib/availability-ping";
import { adjacentLiquidityOfferStartsAt } from "../../lib/home-free-players-carousel";
import { useLayoutDirection } from "../../lib/layout-direction";
import { weekdayIndexFromBeirutDateKey } from "../../lib/near-term-availability";
import { useHomeLiquidityOffers } from "../../hooks/useHomeLiquidityOffers";
import {
  homeFreePlayersQueryOptions,
  ownPreferredZoneIdsQueryOptions,
} from "../../lib/home-free-players-query";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * The next few hours anyone is free, and the people behind the one you pick.
 *
 * Two revisions worth remembering. The blocks used to be full-width rows that
 * opened `/free-block`, a screen running the same query against the same RPC as
 * the Discover tab — a second discovery surface reachable only from here. They
 * are now a chip row that selects, and the players sit directly beneath.
 *
 * And the counts are gone from the chips. "5 free" was a proxy for the people,
 * printed because there was no room to show them; now that the carousel shows
 * actual faces, the number competes with the thing it stood in for. Whoever
 * wants the full list taps through to Discover, where the count is the length
 * of the list.
 *
 * An empty week is not rendered here. First-run Home already has one play CTA;
 * stacking "add when you play" on top of it taught emptiness twice.
 */
export function HomeFreeSlots() {
  const { t } = useTranslation();
  const { rowDirection, writingDirection, isRtl } = useLayoutDirection();
  const [selectedStartsAt, setSelectedStartsAt] = useState<string | null>(null);
  // Which side the next set of cards enters from; 0 until the player moves.
  const [enterFrom, setEnterFrom] = useState<-1 | 0 | 1>(0);
  // The tab highlight moves at once; the cards change only once the new
  // tab's players are loaded, so the section never collapses in between.
  const [shownStartsAt, setShownStartsAt] = useState<string | null>(null);
  const latestRequestRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const ownZonesQuery = useQuery(ownPreferredZoneIdsQueryOptions);
  const chipScrollRef = useRef<ScrollView>(null);
  const [chipScrollWidth, setChipScrollWidth] = useState(0);
  const [chipLayouts, setChipLayouts] = useState<
    Record<string, { x: number; width: number }>
  >({});
  const {
    query: liquidityQuery,
    rows: liquidityRows,
    offers,
  } = useHomeLiquidityOffers();

  // Every tab's players up front: there are only a few tabs, and a tab whose
  // players are fetched on switch showed an empty gap, then popped in.
  const ownZoneIds = ownZonesQuery.data;
  const zonesReady = ownZonesQuery.isSuccess;
  useEffect(() => {
    if (!zonesReady) return;
    for (const offer of offers) {
      void queryClient.prefetchQuery(
        homeFreePlayersQueryOptions(offer, ownZoneIds),
      );
    }
  }, [offers, ownZoneIds, queryClient, zonesReady]);

  // Fired once per mount, and deliberately fired when empty too: a tap-through
  // rate is meaningless without knowing how often a player was shown any demand.
  const signalTracked = useRef(false);
  useEffect(() => {
    if (signalTracked.current || liquidityQuery.data === undefined) {
      return;
    }
    signalTracked.current = true;
    trackLiquiditySignalViewed({
      slotCount: liquidityRows.length,
      peakPlayers: peakLiquidity(liquidityRows),
    });
  }, [liquidityQuery.data, liquidityRows]);

  function slotParts(slot: PingSlot): { day: string; part: string } {
    const day =
      slot.dayOffset === 0
        ? t("discover.today")
        : slot.dayOffset === 1
          ? t("discover.tomorrow")
          : t(
              `availability.weekdaysShort.${weekdayIndexFromBeirutDateKey(slot.dateKey)}`,
            );

    return { day, part: t(`availability.blocks.${slot.part}`) };
  }

  function slotLabel(slot: PingSlot): string {
    const { day, part } = slotParts(slot);
    // Composed here rather than through a key, matching
    // formatNearTermAvailabilitySlots: both halves are already translated, so a
    // key would be pure interpolation and identical across locales, which the
    // parity guard rejects.
    return `${day} · ${part}`;
  }

  // Keep the selected tab in view when a swipe on the cards changes it. Left
  // to right only: the RTL row is reversed and its offsets are unverified.
  const selectedLayout = selectedStartsAt
    ? chipLayouts[selectedStartsAt]
    : undefined;
  useEffect(() => {
    if (isRtl || !selectedLayout || chipScrollWidth <= 0) return;
    chipScrollRef.current?.scrollTo({
      x: Math.max(
        0,
        selectedLayout.x + selectedLayout.width / 2 - chipScrollWidth / 2,
      ),
      animated: true,
    });
  }, [chipScrollWidth, isRtl, selectedLayout]);

  if (liquidityQuery.isPending) {
    return null;
  }

  if (liquidityQuery.isError) {
    return (
      <View style={styles.root}>
        <AppText style={[tennisTextStyles.sectionTitle, { writingDirection }]}>
          {t("home.free.busiestTitle")}
        </AppText>
        <ScreenError
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void liquidityQuery.refetch()}
        />
      </View>
    );
  }

  if (offers.length === 0) {
    return null;
  }

  // Derived rather than stored, so a refreshed list that no longer contains the
  // chosen block falls back to the soonest instead of selecting nothing.
  const selected =
    offers.find((offer) => offer.startsAt === selectedStartsAt) ?? offers[0]!;

  const shown =
    offers.find((offer) => offer.startsAt === shownStartsAt) ?? selected;

  function showWhenLoaded(startsAt: string) {
    const offer = offers.find((candidate) => candidate.startsAt === startsAt);
    if (!offer) return;
    latestRequestRef.current = startsAt;
    const reveal = () => {
      // A later switch wins over this one.
      if (latestRequestRef.current === startsAt) setShownStartsAt(startsAt);
    };
    if (!zonesReady) {
      reveal();
      return;
    }
    void queryClient
      .ensureQueryData(homeFreePlayersQueryOptions(offer, ownZoneIds))
      .then(reveal, reveal);
  }

  function selectAdjacentOffer(direction: "next" | "prev") {
    const nextStartsAt = adjacentLiquidityOfferStartsAt(
      offers,
      selected.startsAt,
      direction,
    );
    if (nextStartsAt) {
      setEnterFrom(direction === "next" ? 1 : -1);
      setSelectedStartsAt(nextStartsAt);
      showWhenLoaded(nextStartsAt);
    }
  }

  function selectOffer(startsAt: string) {
    if (startsAt === selected.startsAt) return;
    const from = offers.findIndex(
      (offer) => offer.startsAt === selected.startsAt,
    );
    const to = offers.findIndex((offer) => offer.startsAt === startsAt);
    setEnterFrom(to > from ? 1 : -1);
    setSelectedStartsAt(startsAt);
    showWhenLoaded(startsAt);
  }

  return (
    <View style={styles.root}>
      <AppText style={[tennisTextStyles.sectionTitle, { writingDirection }]}>
        {t("home.free.busiestTitle")}
      </AppText>

      <ScrollView
        ref={chipScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setChipScrollWidth(event.nativeEvent.layout.width)}
        style={styles.chipScroll}
        contentContainerStyle={[
          styles.chipRow,
          { flexDirection: rowDirection },
        ]}
      >
        {offers.map((offer) => {
          const label = slotLabel(offer);
          const { day, part } = slotParts(offer);
          const isSelected = offer.startsAt === selected.startsAt;

          return (
            <Pressable
              key={offer.startsAt}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              // react-native-web does not emit aria-selected for role="button",
              // so the state has to be said rather than implied.
              accessibilityLabel={
                isSelected
                  ? t("home.free.chipSelectedLabel", { slot: label })
                  : t("home.free.chipLabel", { slot: label })
              }
              onPress={() => selectOffer(offer.startsAt)}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setChipLayouts((current) =>
                  current[offer.startsAt]?.x === x &&
                  current[offer.startsAt]?.width === width
                    ? current
                    : { ...current, [offer.startsAt]: { x, width } },
                );
              }}
              hitSlop={{ top: 8, bottom: 8 }}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
            >
              {/* Two lines, day over time of day: one line ("Tomorrow ·
                  Afternoon") fitted only two tabs on a phone. */}
              <AppText
                style={[styles.chipDay, isSelected && styles.chipDaySelected]}
                maxLines={1}
              >
                {day}
              </AppText>
              <AppText
                style={[
                  styles.chipLabel,
                  isSelected && styles.chipLabelSelected,
                ]}
                maxLines={1}
              >
                {part}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <SlideIn key={shown.startsAt} from={enterFrom} isRtl={isRtl}>
        <HomeFreePlayersCarousel
          block={{
            startsAt: shown.startsAt,
            endsAt: shown.endsAt,
            label: slotLabel(shown),
          }}
          onScrollPastEnd={() => selectAdjacentOffer("next")}
          onScrollPastStart={() => selectAdjacentOffer("prev")}
        />
      </SlideIn>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      gap: tennisSpacing.sectionTitleContent,
    },
    // Text tabs rather than filled pills. Three of them sit directly above the
    // cards they switch, so a filled chip would carry more weight than the
    // players it is selecting between; the accent alone marks the active one.
    // flexGrow: 0 stops a horizontal ScrollView on web from taking a full
    // line-box of leftover height between the title and the cards.
    chipScroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    chipRow: {
      gap: 20,
      alignItems: "flex-start",
    },
    chip: {
      justifyContent: "center",
      alignItems: "flex-start",
      paddingHorizontal: 2,
      paddingVertical: 0,
      backgroundColor: "transparent",
    },
    chipSelected: {
      backgroundColor: "transparent",
    },
    chipPressed: {
      opacity: 0.7,
    },
    chipDay: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    chipDaySelected: {
      color: tennisColors.violetText,
    },
    chipLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    chipLabelSelected: {
      color: tennisColors.violetText,
      fontFamily: tennisFontFamily.bodySemi,
    },
  }),
);
