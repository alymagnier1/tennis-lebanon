import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { ErrorNotice } from "../FormUi";
import { FigmaSecondaryButton } from "../onboarding-ui";
import { HomeFreePlayersCarousel } from "./HomeFreePlayersCarousel";
import { trackLiquiditySignalViewed } from "../../lib/analytics";
import { peakLiquidity } from "../../lib/availability-liquidity";
import { type PingSlot } from "../../lib/availability-ping";
import { useLayoutDirection } from "../../lib/layout-direction";
import { weekdayIndexFromBeirutDateKey } from "../../lib/near-term-availability";
import { useHomeLiquidityOffers } from "../../hooks/useHomeLiquidityOffers";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
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
  const { rowDirection, writingDirection } = useLayoutDirection();
  const [selectedStartsAt, setSelectedStartsAt] = useState<string | null>(null);
  const {
    query: liquidityQuery,
    rows: liquidityRows,
    offers,
  } = useHomeLiquidityOffers();

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

  function slotLabel(slot: PingSlot): string {
    const dayLabel =
      slot.dayOffset === 0
        ? t("discover.today")
        : slot.dayOffset === 1
          ? t("discover.tomorrow")
          : t(
              `availability.weekdaysShort.${weekdayIndexFromBeirutDateKey(slot.dateKey)}`,
            );

    // Composed here rather than through a key, matching
    // formatNearTermAvailabilitySlots: both halves are already translated, so a
    // key would be pure interpolation and identical across locales, which the
    // parity guard rejects.
    return `${dayLabel} · ${t(`availability.blocks.${slot.part}`)}`;
  }

  if (liquidityQuery.isPending) {
    return null;
  }

  if (liquidityQuery.isError) {
    return (
      <View style={styles.root}>
        <AppText style={[styles.title, { writingDirection }]}>
          {t("home.free.busiestTitle")}
        </AppText>
        <ErrorNotice>{t("home.loadError")}</ErrorNotice>
        <FigmaSecondaryButton
          label={t("common.retry")}
          onPress={() => void liquidityQuery.refetch()}
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

  return (
    <View style={styles.root}>
      <AppText style={[styles.title, { writingDirection }]}>
        {t("home.free.busiestTitle")}
      </AppText>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={[
          styles.chipRow,
          { flexDirection: rowDirection },
        ]}
      >
        {offers.map((offer) => {
          const label = slotLabel(offer);
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
              onPress={() => setSelectedStartsAt(offer.startsAt)}
              hitSlop={{ top: 8, bottom: 8 }}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
            >
              <AppText
                style={[
                  styles.chipLabel,
                  isSelected && styles.chipLabelSelected,
                ]}
                maxLines={1}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <HomeFreePlayersCarousel
        block={{
          startsAt: selected.startsAt,
          endsAt: selected.endsAt,
          label: slotLabel(selected),
        }}
      />
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      gap: tennisSpacing.sectionTitleContent,
    },
    title: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 18,
      color: tennisColors.primaryDark,
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
      gap: 16,
      alignItems: "center",
    },
    chip: {
      justifyContent: "center",
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
    chipLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    chipLabelSelected: {
      color: tennisColors.violet,
      fontFamily: tennisFontFamily.bodySemi,
    },
  }),
);
