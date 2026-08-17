import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAvailabilityLiquidity,
  listOwnAvailability,
  recordAvailabilityPing,
} from "@tennis-lebanon/api";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { trackEvent, trackLiquiditySignalViewed } from "../../lib/analytics";
import {
  liquidityCountForSlot,
  peakLiquidity,
  pickLiquidityHighlights,
  toLiquidityRows,
} from "../../lib/availability-liquidity";
import {
  isSlotAlreadyPinged,
  nextPingSlots,
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

type PingRequest = {
  slot: PingSlot;
  /** Which half of the section the tap came from. */
  surface: "chip" | "liquidity";
  /** Others already free in that block when the player tapped. */
  playerCount: number;
};

/**
 * The smallest thing a player can do that means "I would play", and the reason to
 * bother doing it.
 *
 * Creating a match asks for format, level, zone, clubs and a time. Someone with a
 * free evening and mild interest does none of that, so the evening is lost. One
 * tap here writes a one-off availability window, which makes them visible to
 * everyone whose availability overlaps — no match, no commitment, nothing to
 * cancel.
 *
 * The counts are what stop that tap being a diary entry. Declaring a free Thursday
 * into silence teaches a player that nothing happens; seeing that four others are
 * free the same evening is the reason to declare it. The two halves are one
 * section on purpose — the question and the answer belong together.
 */
export function HomeFreeSlots() {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const queryClient = useQueryClient();
  const [justPinged, setJustPinged] = useState<string | null>(null);

  // Recomputed per render from a single clock read, so every slot in one paint
  // agrees about "now".
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const slots = useMemo(() => nextPingSlots(nowIso, 4), [nowIso]);

  const availabilityQuery = useQuery({
    queryKey: ["own-availability"],
    queryFn: () => listOwnAvailability(supabase),
    staleTime: 30_000,
  });

  const liquidityQuery = useQuery({
    queryKey: ["availability-liquidity"],
    queryFn: () => getAvailabilityLiquidity(supabase, 7),
    staleTime: 60_000,
  });

  const pingMutation = useMutation({
    mutationFn: (request: PingRequest) =>
      recordAvailabilityPing(
        supabase,
        request.slot.startsAt,
        request.slot.endsAt,
      ),
    onSuccess: async (_id, request) => {
      setJustPinged(request.slot.startsAt);
      trackEvent("availability_ping_sent", {
        day_part: request.slot.part,
        day_offset: request.slot.dayOffset,
        surface: request.surface,
        player_count: request.playerCount,
      });
      // Discovery reads availability overlap, so a fresh ping changes what other
      // players see and what this player's own filters return. The liquidity
      // counts are left alone deliberately: they exclude the caller, so pinging
      // never changes the player's own numbers.
      await queryClient.invalidateQueries({ queryKey: ["own-availability"] });
      await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
    },
  });

  const windows = availabilityQuery.data ?? [];

  const liquidityRows = useMemo(
    () => toLiquidityRows(liquidityQuery.data ?? [], nowIso),
    [liquidityQuery.data, nowIso],
  );

  const highlights = useMemo(
    () => pickLiquidityHighlights(liquidityRows, slots, 2),
    [liquidityRows, slots],
  );

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

  if (slots.length === 0) {
    return null;
  }

  // Searched across both halves: a tap on a busiest-week row deserves the same
  // confirmation sentence as a chip, and looking only at `slots` would leave the
  // row silent apart from turning green.
  const pingedSlot = [...slots, ...highlights].find(
    (slot) => slot.startsAt === justPinged,
  );

  return (
    <View style={styles.root}>
      <AppText style={[styles.title, { writingDirection }]}>
        {t("home.free.title")}
      </AppText>
      <AppText style={[styles.subtitle, { writingDirection }]}>
        {t("home.free.subtitle")}
      </AppText>

      <View style={[styles.chips, { flexDirection: rowDirection }]}>
        {slots.map((slot) => {
          const alreadyFree = isSlotAlreadyPinged(slot, windows);
          const label = slotLabel(slot);
          const others = liquidityCountForSlot(slot, liquidityRows);

          return (
            <Pressable
              key={slot.startsAt}
              accessibilityRole="button"
              // The state goes in the label, not only in accessibilityState:
              // react-native-web does not emit aria-selected for role="button",
              // so a screen reader would otherwise announce the chip as merely
              // dimmed without saying why.
              accessibilityLabel={[
                t(
                  alreadyFree
                    ? "home.free.chipLabelSet"
                    : "home.free.chipLabel",
                  { slot: label },
                ),
                others > 0
                  ? t("home.free.othersFree", { players: others })
                  : "",
              ]
                .filter(Boolean)
                .join(", ")}
              accessibilityState={{
                selected: alreadyFree,
                disabled: alreadyFree,
              }}
              disabled={alreadyFree || pingMutation.isPending}
              onPress={() =>
                pingMutation.mutate({
                  slot,
                  surface: "chip",
                  playerCount: others,
                })
              }
              style={({ pressed }) => [
                styles.chip,
                alreadyFree && styles.chipSelected,
                pressed && !alreadyFree && styles.chipPressed,
              ]}
            >
              <AppText
                style={[
                  styles.chipText,
                  alreadyFree && styles.chipTextSelected,
                ]}
                maxLines={1}
              >
                {label}
              </AppText>
              {others > 0 ? (
                <AppText
                  style={[
                    styles.chipCount,
                    alreadyFree && styles.chipTextSelected,
                  ]}
                  maxLines={1}
                >
                  {t("home.free.othersFree", { players: others })}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Feedback, not a fake number: the ping genuinely makes them findable by
          availability overlap, so say that rather than inventing a count. */}
      {pingedSlot ? (
        <AppText style={[styles.confirmation, { writingDirection }]}>
          {t("home.free.confirmation", { slot: slotLabel(pingedSlot) })}
        </AppText>
      ) : null}

      {pingMutation.isError ? (
        <AppText
          accessibilityRole="alert"
          style={[styles.error, { writingDirection }]}
        >
          {t("home.free.error")}
        </AppText>
      ) : null}

      {/* The week's peak, which the chips cannot reach: they only cover the next
          few blocks, and "everyone plays Thursday" is the thing worth knowing.
          Rendered only when there is real demand — an empty version would be a
          dead heading, and the chips above are already the answer to "nobody is
          free", since somebody has to go first. */}
      {highlights.length > 0 ? (
        <View style={styles.highlights}>
          <AppText style={[styles.highlightsTitle, { writingDirection }]}>
            {t("home.free.busiestTitle")}
          </AppText>

          {highlights.map((row) => {
            const alreadyFree = isSlotAlreadyPinged(row, windows);
            const label = slotLabel(row);

            return (
              <Pressable
                key={row.startsAt}
                accessibilityRole="button"
                accessibilityLabel={`${t(
                  alreadyFree
                    ? "home.free.chipLabelSet"
                    : "home.free.chipLabel",
                  { slot: label },
                )}, ${t("home.free.othersFree", { players: row.playerCount })}`}
                accessibilityState={{
                  selected: alreadyFree,
                  disabled: alreadyFree,
                }}
                disabled={alreadyFree || pingMutation.isPending}
                onPress={() =>
                  pingMutation.mutate({
                    slot: row,
                    surface: "liquidity",
                    playerCount: row.playerCount,
                  })
                }
                style={({ pressed }) => [
                  styles.row,
                  { flexDirection: rowDirection },
                  alreadyFree && styles.rowSelected,
                  pressed && !alreadyFree && styles.chipPressed,
                ]}
              >
                <AppText style={styles.rowLabel} maxLines={1}>
                  {label}
                </AppText>
                <AppText style={styles.rowCount} maxLines={1}>
                  {t("home.free.othersFree", { players: row.playerCount })}
                </AppText>
              </Pressable>
            );
          })}
        </View>
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
  chips: {
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  chip: {
    minHeight: minTouchTargetPx,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: tennisRadii.pill,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  chipSelected: {
    backgroundColor: tennisSemantic.positive.fill,
    borderColor: tennisSemantic.positive.border,
  },
  chipPressed: {
    opacity: 0.9,
  },
  chipText: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  chipCount: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    lineHeight: 14,
    color: tennisColors.mutedForeground,
  },
  chipTextSelected: {
    color: tennisSemantic.positive.text,
  },
  highlights: {
    gap: 6,
    marginTop: 6,
  },
  highlightsTitle: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.mutedForeground,
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
  rowCount: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primary,
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
