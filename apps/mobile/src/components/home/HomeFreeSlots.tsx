import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "../AppText";
import { ScreenError } from "../FormUi";
import { SlideIn } from "../SlideIn";
import {
  HomeFreePlayersCarousel,
  HomeFreePlayersSkeleton,
} from "./HomeFreePlayersCarousel";
import { trackLiquiditySignalViewed } from "../../lib/analytics";
import {
  peakLiquidity,
  type LiquidityDay,
} from "../../lib/availability-liquidity";
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
 * Who is free today, tomorrow and the day after, and the people behind the
 * day you pick.
 *
 * Revisions worth remembering. The blocks used to be full-width rows that
 * opened `/free-block`, a screen running the same query against the same RPC as
 * the Discover tab — a second discovery surface reachable only from here. They
 * became a tab row that selects, with the players directly beneath.
 *
 * The counts are gone from the tabs. "5 free" was a proxy for the people,
 * printed because there was no room to show them; now that the carousel shows
 * actual faces, the number competes with the thing it stood in for.
 *
 * The tabs are days, not day parts (2026-09-27): "Tomorrow · Afternoon" fitted
 * two tabs on a phone and made the player choose twice.
 *
 * An empty week is not rendered here. First-run Home already has one play CTA;
 * stacking "add when you play" on top of it taught emptiness twice.
 */
export function HomeFreeSlots() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { rowDirection, writingDirection, isRtl } = useLayoutDirection();
  const [selectedStartsAt, setSelectedStartsAt] = useState<string | null>(null);
  // Which side the next set of cards enters from; 0 until the player moves.
  const [enterFrom, setEnterFrom] = useState<-1 | 0 | 1>(0);
  // The tab highlight moves at once; the cards change only once the new
  // day's players are loaded, so the section never collapses in between.
  const [shownStartsAt, setShownStartsAt] = useState<string | null>(null);
  const latestRequestRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const ownZonesQuery = useQuery(ownPreferredZoneIdsQueryOptions);
  const {
    query: liquidityQuery,
    rows: liquidityRows,
    days,
  } = useHomeLiquidityOffers();

  // Every day's players up front: a tab whose players were fetched on switch
  // showed an empty gap, then popped in.
  const ownZoneIds = ownZonesQuery.data;
  const zonesReady = ownZonesQuery.isSuccess;
  useEffect(() => {
    if (!zonesReady) return;
    for (const day of days) {
      void queryClient.prefetchQuery(
        homeFreePlayersQueryOptions(day, ownZoneIds),
      );
    }
  }, [days, ownZoneIds, queryClient, zonesReady]);

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

  function dayLabel(day: LiquidityDay): string {
    if (day.dayOffset === 0) return t("discover.today");
    if (day.dayOffset === 1) return t("discover.tomorrow");
    const weekday = t(
      `availability.weekdays.${weekdayIndexFromBeirutDateKey(day.dateKey)}`,
    );
    // French weekdays are lower case mid-sentence; a tab starts one.
    return weekday.charAt(0).toLocaleUpperCase(locale) + weekday.slice(1);
  }

  const title = (
    <AppText style={[tennisTextStyles.sectionTitle, { writingDirection }]}>
      {t("home.free.busiestTitle")}
    </AppText>
  );

  // Hold the section's space while the days load, so Home does not render
  // without it and then push everything below down.
  if (liquidityQuery.isPending) {
    return (
      <View style={styles.root} accessibilityElementsHidden>
        {title}
        <View style={[styles.tabRow, { flexDirection: rowDirection }]}>
          {[0, 1, 2].map((index) => (
            <AppText key={index} style={[styles.tabLabel, styles.tabSkeleton]}>
              {" "}
            </AppText>
          ))}
        </View>
        <HomeFreePlayersSkeleton />
      </View>
    );
  }

  if (liquidityQuery.isError) {
    return (
      <View style={styles.root}>
        {title}
        <ScreenError
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void liquidityQuery.refetch()}
        />
      </View>
    );
  }

  if (days.length === 0) {
    return null;
  }

  // Derived rather than stored, so a refreshed list that no longer contains the
  // chosen day falls back to the soonest instead of selecting nothing.
  const selected =
    days.find((day) => day.startsAt === selectedStartsAt) ?? days[0]!;
  const shown = days.find((day) => day.startsAt === shownStartsAt) ?? selected;

  function showWhenLoaded(startsAt: string) {
    const day = days.find((candidate) => candidate.startsAt === startsAt);
    if (!day) return;
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
      .ensureQueryData(homeFreePlayersQueryOptions(day, ownZoneIds))
      .then(reveal, reveal);
  }

  function selectDay(startsAt: string, from: -1 | 1) {
    setEnterFrom(from);
    setSelectedStartsAt(startsAt);
    showWhenLoaded(startsAt);
  }

  function selectAdjacentDay(direction: "next" | "prev") {
    const nextStartsAt = adjacentLiquidityOfferStartsAt(
      days,
      selected.startsAt,
      direction,
    );
    if (nextStartsAt) selectDay(nextStartsAt, direction === "next" ? 1 : -1);
  }

  const selectedIndex = days.indexOf(selected);

  return (
    <View style={styles.root}>
      {title}

      <View style={[styles.tabRow, { flexDirection: rowDirection }]}>
        {days.map((day, index) => {
          const label = dayLabel(day);
          const isSelected = day === selected;

          return (
            <Pressable
              key={day.startsAt}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              // react-native-web does not emit aria-selected for role="button",
              // so the state has to be said rather than implied.
              accessibilityLabel={
                isSelected
                  ? t("home.free.chipSelectedLabel", { slot: label })
                  : t("home.free.chipLabel", { slot: label })
              }
              onPress={() => {
                if (!isSelected) {
                  selectDay(day.startsAt, index > selectedIndex ? 1 : -1);
                }
              }}
              hitSlop={{ top: 8, bottom: 8 }}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
              ]}
            >
              <AppText
                style={[styles.tabLabel, isSelected && styles.tabLabelSelected]}
                maxLines={1}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <SlideIn key={shown.startsAt} from={enterFrom} isRtl={isRtl}>
        <HomeFreePlayersCarousel
          block={{
            startsAt: shown.startsAt,
            endsAt: shown.endsAt,
            label: dayLabel(shown),
          }}
          onScrollPastEnd={() => selectAdjacentDay("next")}
          onScrollPastStart={() => selectAdjacentDay("prev")}
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
    // Text tabs rather than filled pills. They sit directly above the cards
    // they switch, so a filled chip would carry more weight than the players
    // it is selecting between; the accent alone marks the active one.
    tabRow: {
      gap: 20,
      alignItems: "center",
    },
    tab: {
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    tabPressed: {
      opacity: 0.7,
    },
    tabLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
    tabLabelSelected: {
      color: tennisColors.violetText,
      fontFamily: tennisFontFamily.bodySemi,
    },
    tabSkeleton: {
      width: 64,
      borderRadius: 4,
      backgroundColor: tennisColors.muted,
    },
  }),
);
