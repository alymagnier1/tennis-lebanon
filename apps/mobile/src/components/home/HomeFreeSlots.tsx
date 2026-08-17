import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAvailabilityWindow,
  getAvailabilityLiquidity,
  listOwnAvailability,
  recordAvailabilityPing,
} from "@tennis-lebanon/api";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { trackEvent, trackLiquiditySignalViewed } from "../../lib/analytics";
import {
  peakLiquidity,
  pickBusiestBlocks,
  toLiquidityRows,
  type LiquidityRow,
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
 * Where the week's demand is, and one tap to join it.
 *
 * The list reports the busiest upcoming blocks — a fact about the week, not a
 * prompt — because a player deciding when to be free needs to know when everyone
 * else already is. Tapping a block writes a one-off availability window, which makes
 * them visible to everyone whose availability overlaps: no match, no commitment,
 * nothing to cancel.
 *
 * Each row's right-hand state comes from the player's own availability, read from
 * the **recurring grid** as well as from earlier pings. That distinction is the
 * whole point of `findSlotCoverage`: a block they are already free for is shown as
 * a statement rather than offered as a question, so the section can never ask
 * something "manage availability" has already answered — which is how three of the
 * first six real taps ended up duplicating the tapper's own grid.
 *
 * A grid entry is not removable here. It belongs to the availability screen, and
 * deleting it from Home would quietly rewrite the player's usual week.
 */
export function HomeFreeSlots() {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const queryClient = useQueryClient();
  const [lastChanged, setLastChanged] = useState<{
    startsAt: string;
    action: "added" | "removed";
  } | null>(null);

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

  const coverageIn = useCallback(
    (slot: PingSlot, against: AvailabilityWindowLike[]) =>
      findSlotCoverage(
        slot,
        weekdayIndexFromBeirutDateKey(slot.dateKey),
        against,
      ),
    [],
  );

  const liquidityRows = useMemo(
    () => toLiquidityRows(liquidityQuery.data ?? [], nowIso),
    [liquidityQuery.data, nowIso],
  );

  // Rows never come and go as the player taps: ranking keys on the count and the
  // start, and a player's own window moves neither. That is what makes a tap
  // reversible — the row is still there to tap again.
  const offers = useMemo(
    () => pickBusiestBlocks(liquidityRows, OFFER_LIMIT),
    [liquidityRows],
  );

  const addMutation = useMutation({
    mutationFn: (offer: LiquidityRow) =>
      recordAvailabilityPing(supabase, offer.startsAt, offer.endsAt),
    onSuccess: async (_id, offer) => {
      setLastChanged({ startsAt: offer.startsAt, action: "added" });
      trackEvent("availability_ping_sent", {
        day_part: offer.part,
        day_offset: offer.dayOffset,
        surface: "home",
        player_count: offer.playerCount,
      });
      await refreshAvailability();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (input: { windowId: string; offer: LiquidityRow }) =>
      deleteAvailabilityWindow(supabase, input.windowId),
    onSuccess: async (_result, input) => {
      setLastChanged({ startsAt: input.offer.startsAt, action: "removed" });
      await refreshAvailability();
    },
  });

  async function refreshAvailability() {
    // Discovery reads availability overlap, so this changes what other players
    // see. The liquidity counts are left alone on purpose: they exclude the
    // caller, so a player's own window never moves their own numbers.
    await queryClient.invalidateQueries({ queryKey: ["own-availability"] });
    await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
  }

  // Fired once per mount, and deliberately fired when empty too: a tap rate is
  // meaningless without knowing how often a player was shown any demand at all.
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

  const busy = addMutation.isPending || removeMutation.isPending;
  const changedOffer = offers.find(
    (offer) => offer.startsAt === lastChanged?.startsAt,
  );

  return (
    <View style={styles.root}>
      <AppText style={[styles.title, { writingDirection }]}>
        {t("home.free.busiestTitle")}
      </AppText>
      <AppText style={[styles.subtitle, { writingDirection }]}>
        {t("home.free.busiestSubtitle")}
      </AppText>

      <View style={styles.rows}>
        {offers.map((offer) => {
          const coverage = coverageIn(offer, windows);
          const label = slotLabel(offer);
          // Only a one-off window is ours to take back. A grid entry belongs to
          // the availability screen, and removing it from Home would quietly edit
          // the player's usual week.
          const removable = coverage?.kind === "one_off";
          const accessibilityLabel = coverage
            ? t(
                removable
                  ? "home.free.rowLabelRemove"
                  : "home.free.rowLabelCovered",
                { slot: label },
              )
            : [
                t("home.free.rowLabelAdd", { slot: label }),
                offer.playerCount > 0
                  ? t("home.free.othersFree", { players: offer.playerCount })
                  : "",
              ]
                .filter(Boolean)
                .join(", ");

          return (
            <Pressable
              key={offer.startsAt}
              accessibilityRole="button"
              // State goes in the label, not only in accessibilityState:
              // react-native-web does not emit aria-selected for role="button",
              // so a screen reader would otherwise hear only a dimmed row.
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{
                selected: Boolean(coverage),
                disabled: Boolean(coverage) && !removable,
              }}
              disabled={busy || (Boolean(coverage) && !removable)}
              onPress={() => {
                if (!coverage) {
                  addMutation.mutate(offer);
                  return;
                }
                if (removable) {
                  removeMutation.mutate({
                    windowId: coverage.window.id,
                    offer,
                  });
                }
              }}
              style={({ pressed }) => [
                styles.row,
                { flexDirection: rowDirection },
                coverage && styles.rowSelected,
                pressed && styles.rowPressed,
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
                    {removable
                      ? t("home.free.remove")
                      : t("home.free.fromAvailability")}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {changedOffer && lastChanged ? (
        <AppText style={[styles.confirmation, { writingDirection }]}>
          {t(
            lastChanged.action === "added"
              ? "home.free.confirmation"
              : "home.free.removedConfirmation",
            { slot: slotLabel(changedOffer) },
          )}
        </AppText>
      ) : null}

      {addMutation.isError || removeMutation.isError ? (
        <AppText
          accessibilityRole="alert"
          style={[styles.error, { writingDirection }]}
        >
          {t("home.free.error")}
        </AppText>
      ) : null}
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
  rowPressed: {
    opacity: 0.9,
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
  confirmation: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: tennisSemantic.positive.text,
  },
  error: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.danger,
  },
});
