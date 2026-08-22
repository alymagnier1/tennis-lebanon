import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  getAvailabilityLiquidity,
  listOwnAvailability,
} from "@tennis-lebanon/api";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { HomeFreePlayersCarousel } from "./HomeFreePlayersCarousel";
import { trackLiquiditySignalViewed } from "../../lib/analytics";
import {
  peakLiquidity,
  pickBusiestBlocks,
  toLiquidityRows,
} from "../../lib/availability-liquidity";
import {
  findSlotCoverage,
  type AvailabilityWindowLike,
  type PingSlot,
} from "../../lib/availability-ping";
import { useLayoutDirection } from "../../lib/layout-direction";
import { weekdayIndexFromBeirutDateKey } from "../../lib/near-term-availability";
import { supabase } from "../../lib/supabase";
import {
  tennisColors,
  tennisRadii,
  tennisSemantic,
} from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/** How far ahead the counts look, and how many blocks to list. */
const OFFER_HORIZON_DAYS = 7;
const OFFER_LIMIT = 3;

/**
 * Where the week's demand is, and a way through to the players behind it.
 *
 * The list reports the busiest upcoming blocks — a fact about the week, not a
 * prompt — because a player deciding when to play needs to know when everyone else
 * already is. Tapping opens that block's players, which is what makes the number
 * worth printing: "5 free" was a fact nobody could act on until it led somewhere.
 *
 * Each row's second line comes from the player's own availability, read from the
 * **recurring grid** as well as from earlier pings.
 *
 * The rows do not navigate. They used to open `/free-block`, a screen that ran the
 * same query against the same RPC as the Discover tab and drew the same cards --
 * a second discovery surface reachable only from here. The players behind the
 * busiest block now sit in a carousel directly beneath, and the full list lives
 * where players already look for people.
 */
export function HomeFreeSlots() {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  // One clock read per mount, so every block in one paint agrees about "now".
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const availabilityQuery = useQuery({
    queryKey: ["own-availability"],
    queryFn: () => listOwnAvailability(supabase),
    staleTime: 30_000,
  });

  const liquidityQuery = useQuery({
    queryKey: ["availability-liquidity"],
    queryFn: () => getAvailabilityLiquidity(supabase, OFFER_HORIZON_DAYS),
    staleTime: 60_000,
  });

  const windows: AvailabilityWindowLike[] = availabilityQuery.data ?? [];

  const liquidityRows = useMemo(
    () => toLiquidityRows(liquidityQuery.data ?? [], nowIso),
    [liquidityQuery.data, nowIso],
  );

  const offers = useMemo(
    () => pickBusiestBlocks(liquidityRows, OFFER_LIMIT),
    [liquidityRows],
  );

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

  // No block in the week has anyone free in it. Under a heading that says "most
  // players free" there is nothing honest to list, so the section disappears.
  if (offers.length === 0) {
    return null;
  }

  return (
    <View style={styles.root}>
      <AppText style={[styles.title, { writingDirection }]}>
        {t("home.free.busiestTitle")}
      </AppText>
      <AppText style={[styles.subtitle, { writingDirection }]}>
        {t("home.free.busiestSubtitle")}
      </AppText>

      {offers[0] ? (
        <HomeFreePlayersCarousel
          block={{
            startsAt: offers[0].startsAt,
            endsAt: offers[0].endsAt,
            playerCount: offers[0].playerCount,
            label: slotLabel(offers[0]),
          }}
        />
      ) : null}

      <View style={styles.rows}>
        {offers.map((offer) => {
          const coverage = findSlotCoverage(
            offer,
            weekdayIndexFromBeirutDateKey(offer.dateKey),
            windows,
          );
          const label = slotLabel(offer);

          return (
            <View
              key={offer.startsAt}
              // Read as one statement rather than a label and a stray number:
              // the row is no longer a control, so nothing here is tappable.
              accessibilityLabel={[
                t("home.free.rowLabel", {
                  slot: label,
                  players: offer.playerCount,
                }),
                coverage
                  ? t(
                      coverage.kind === "one_off"
                        ? "home.free.youAreFree"
                        : "home.free.fromAvailability",
                    )
                  : "",
              ]
                .filter(Boolean)
                .join(", ")}
              style={[
                styles.row,
                { flexDirection: rowDirection },
                coverage && styles.rowSelected,
              ]}
            >
              <AppText
                style={[styles.rowLabel, coverage && styles.rowLabelSelected]}
                maxLines={1}
              >
                {label}
              </AppText>
              <View style={styles.rowMetaGroup}>
                {/* The count stays put whatever the player's own state is: it is
                    information about the week, not feedback on their tap. */}
                <AppText
                  style={[styles.rowMeta, coverage && styles.rowMetaSelected]}
                  maxLines={1}
                >
                  {t("home.free.othersFree", { players: offer.playerCount })}
                </AppText>
                {coverage ? (
                  <AppText style={styles.rowState} maxLines={1}>
                    {t(
                      coverage.kind === "one_off"
                        ? "home.free.youAreFree"
                        : "home.free.fromAvailability",
                    )}
                  </AppText>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  title: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 18,
    color: tennisColors.primaryDark,
  },
  subtitle: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: tennisColors.mutedForeground,
  },
  rows: {
    gap: 6,
    marginTop: 2,
  },
  row: {
    minHeight: minTouchTargetPx,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tennisRadii.md,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  rowSelected: {
    backgroundColor: tennisSemantic.positive.fill,
    borderColor: tennisSemantic.positive.border,
  },
  rowLabel: {
    flexShrink: 1,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primaryDark,
  },
  rowLabelSelected: {
    color: tennisSemantic.positive.text,
  },
  rowMetaGroup: {
    alignItems: "flex-end",
  },
  rowMeta: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primary,
  },
  rowMetaSelected: {
    color: tennisSemantic.positive.text,
  },
  rowState: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    lineHeight: 14,
    color: tennisColors.mutedForeground,
  },
});
