import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import type {
  MatchHubBooking,
  MatchHubCard,
  MatchPreferredClub,
} from "@tennis-lebanon/api";
import { getClubDetail, getClubWhatsAppBookingLink } from "@tennis-lebanon/api";
import { formatPriceMinor } from "@tennis-lebanon/domain";
import type { Json } from "@tennis-lebanon/types";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { FigmaPrimaryButton } from "../onboarding-ui";
import { formatUtcSlotInBeirut } from "../../lib/beirut-time";
import { clubBookingAction } from "../../lib/club-booking-action";
import { confirmAction } from "../../lib/confirm-action";
import { useLayoutDirection } from "../../lib/layout-direction";
import { preferredClubLocationLabel } from "../../lib/match-clubs";
import { clubDetailRoute, matchBookExternalRoute } from "../../lib/routes";
import { openWhatsAppBooking } from "../../lib/whatsapp-booking";
import { useConfirmExternalCourt } from "../../hooks/useConfirmExternalCourt";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../providers/ToastProvider";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { MatchHubConfirmedHero } from "./MatchHubConfirmedHero";
import { HubDestructiveLink } from "./HubSummaryRow";
import { hubSectionStyles } from "./hub-section-styles";

type MatchHubPreferredClubsProps = {
  clubs: MatchPreferredClub[];
  matchId: string;
  isHost?: boolean;
  canConfirmCourt?: boolean;
  agreedSlot?: { starts_at: string; ends_at: string } | null;
  booking?: MatchHubBooking | null;
  onRelease?: () => void;
  releasing?: boolean;
};

function buildOptimisticBooking(input: {
  club: MatchPreferredClub;
  court: {
    court_id: string;
    name: string;
    price_minor: number | null;
    currency: string | null;
  };
  slot: { starts_at: string; ends_at: string };
}): MatchHubBooking {
  return {
    booking_id: "optimistic",
    status: "accepted",
    court_id: input.court.court_id,
    court_name: input.court.name,
    club_id: input.club.club_id,
    club_name: input.club.name,
    starts_at: input.slot.starts_at,
    ends_at: input.slot.ends_at,
    price_minor: input.court.price_minor,
    currency: input.court.currency,
    payment_method: "pay_at_club",
    club_note: null,
    proposed_court_id: null,
    proposed_court_name: null,
    proposed_start_at: null,
    proposed_end_at: null,
  };
}

/**
 * Preferred clubs on the hub. Confirm instantly keeps the chosen card and drops
 * the rest — no exit animation (height/opacity animations were the flicker).
 */
export function MatchHubPreferredClubs({
  clubs,
  matchId,
  isHost = false,
  canConfirmCourt = false,
  agreedSlot = null,
  booking = null,
  onRelease,
  releasing = false,
}: MatchHubPreferredClubsProps) {
  const { t, i18n } = useTranslation();
  const { writingDirection } = useLayoutDirection();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(
    () => booking?.club_id ?? null,
  );
  /** Local accepted booking so the UI settles before the hub refetch returns. */
  const [optimisticBooking, setOptimisticBooking] =
    useState<MatchHubBooking | null>(null);

  /**
   * The server booking supersedes the optimistic one. Adjusting during render
   * rather than in an effect: an effect renders the stale optimistic booking
   * once before correcting it, and `booking` is a fresh object on every hub
   * refetch, so the effect re-ran constantly. Keying on the id means this runs
   * only when the booking actually changes — including to none, after a
   * release, which is when a leftover optimistic booking would resurface.
   */
  const bookingId = booking?.booking_id ?? null;
  const [lastBookingId, setLastBookingId] = useState<string | null>(bookingId);
  if (bookingId !== lastBookingId) {
    setLastBookingId(bookingId);
    setOptimisticBooking(null);
    if (booking) {
      setSelectedClubId(booking.club_id);
    }
  }

  const effectiveBooking = booking ?? optimisticBooking;
  const settled = Boolean(effectiveBooking);

  const clubQueries = useQueries({
    queries: clubs.map((club) => ({
      queryKey: ["club-detail", club.club_id],
      queryFn: () => getClubDetail(supabase, club.club_id),
      staleTime: 60_000,
    })),
  });

  const { showToast } = useToast();
  const confirmMutation = useConfirmExternalCourt(matchId, {
    suppressToast: true,
    onSuccess: () => {
      showToast(t("matches.booking.externalSuccess"));
    },
    onError: () => {
      setOptimisticBooking(null);
      void queryClient.invalidateQueries({ queryKey: ["match-hub", matchId] });
    },
  });

  const bookedInList =
    effectiveBooking != null &&
    clubs.some((club) => club.club_id === effectiveBooking.club_id);

  if (effectiveBooking && !bookedInList) {
    return (
      <MatchHubConfirmedHero
        booking={effectiveBooking}
        matchId={matchId}
        releasing={releasing}
        onRelease={onRelease}
      />
    );
  }

  if (clubs.length === 0) return null;

  const isConfirmStage = isHost && canConfirmCourt && !settled;
  const selectedIndex = clubs.findIndex(
    (club) => club.club_id === (effectiveBooking?.club_id ?? selectedClubId),
  );
  const selectedClub = selectedIndex >= 0 ? clubs[selectedIndex] : undefined;
  const selectedDetail =
    selectedIndex >= 0 ? clubQueries[selectedIndex]?.data : undefined;
  const confirmCourt = selectedDetail?.courts[0] ?? null;
  const noCourts =
    Boolean(selectedClubId) &&
    clubQueries[selectedIndex]?.isSuccess === true &&
    !confirmCourt;
  const payLine = effectiveBooking
    ? [
        t("clubs.payAtClub"),
        formatPriceMinor(
          effectiveBooking.price_minor,
          effectiveBooking.currency,
        ),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const keptClubId = effectiveBooking?.club_id ?? selectedClubId;
  const visibleClubs = settled
    ? clubs.filter((club) => club.club_id === keptClubId)
    : clubs;

  function openClub(club: MatchPreferredClub) {
    router.push(clubDetailRoute(club.club_id, { matchId }));
  }

  async function messageClub(club: MatchPreferredClub) {
    setPendingClubId(club.club_id);
    try {
      const link = await getClubWhatsAppBookingLink(
        supabase,
        club.club_id,
        matchId,
      );
      await openWhatsAppBooking(link);
    } catch {
      Alert.alert(t("clubs.whatsappError"));
    } finally {
      setPendingClubId(null);
    }
  }

  function handleConfirm() {
    if (!confirmCourt || !agreedSlot || !selectedClub) return;

    confirmAction({
      title: t("matches.booking.bookedOffAppConfirmTitle"),
      message: t("matches.booking.bookedOffAppConfirmBody", {
        club: selectedClub.name,
        court: confirmCourt.name,
        time: formatUtcSlotInBeirut(agreedSlot.starts_at, agreedSlot.ends_at),
      }),
      confirmLabel: t("matches.booking.bookedOffAppConfirm"),
      cancelLabel: t("common.cancel"),
      onConfirm: () => {
        // Settle under the dialog before it dismisses — closing first was
        // flashing the full picker for a frame.
        const nextBooking = buildOptimisticBooking({
          club: selectedClub,
          court: confirmCourt,
          slot: agreedSlot,
        });
        setOptimisticBooking(nextBooking);
        queryClient.setQueryData<MatchHubCard>(
          ["match-hub", matchId],
          (current) => {
            if (!current) return current;
            const nextStatus =
              current.status === "ready_to_book" ||
              current.status === "booking_pending"
                ? "confirmed"
                : current.status;
            return {
              ...current,
              status: nextStatus,
              booking: nextBooking,
              next_action:
                nextStatus === "confirmed"
                  ? "pay_at_club"
                  : current.next_action,
            };
          },
        );
        confirmMutation.mutate({
          courtId: confirmCourt.court_id,
          startsAt: agreedSlot.starts_at,
          endsAt: agreedSlot.ends_at,
        });
      },
    });
  }

  return (
    <View style={hubSectionStyles.root}>
      <AppText style={hubSectionStyles.sectionLabel}>
        {settled
          ? t("matches.hub.courtHeroTitle")
          : isConfirmStage
            ? t("matches.hub.whichCourtTitle")
            : t("matches.hub.preferredClubs")}
      </AppText>

      <View style={styles.list}>
        {visibleClubs.map((club) => {
          const index = clubs.findIndex((row) => row.club_id === club.club_id);
          const selected = selectedClubId === club.club_id;
          const showMessage =
            isHost &&
            isConfirmStage &&
            clubBookingAction(club.booking_mode) === "whatsapp";
          const loading = pendingClubId === club.club_id;
          const detail = index >= 0 ? clubQueries[index]?.data : undefined;
          const location = preferredClubLocationLabel({
            addressPublic: detail?.address_public,
            zoneNameI18n: (detail?.zone_name_i18n ?? null) as Json,
            locale,
          });
          const courtName = settled ? effectiveBooking?.court_name : undefined;

          return (
            <Pressable
              key={club.club_id}
              accessibilityRole={isConfirmStage ? "radio" : "button"}
              accessibilityState={isConfirmStage ? { selected } : undefined}
              accessibilityLabel={club.name}
              disabled={settled}
              onPress={() => {
                if (isConfirmStage) {
                  setSelectedClubId(club.club_id);
                  return;
                }
                openClub(club);
              }}
              style={({ pressed }) => [
                styles.clubCard,
                pressed && !settled && styles.pressed,
              ]}
            >
              <View style={styles.cardBody}>
                <View style={styles.infoColumn}>
                  <View style={styles.titleRow}>
                    {isConfirmStage ? (
                      <View
                        style={[styles.radio, selected && styles.radioSelected]}
                      >
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                    ) : null}
                    <View style={styles.titleBlock}>
                      <AppText
                        style={[styles.name, { writingDirection }]}
                        maxLines={2}
                      >
                        {club.name}
                      </AppText>
                      {courtName ? (
                        <>
                          <AppText
                            style={[styles.courtName, { writingDirection }]}
                            maxLines={1}
                          >
                            {courtName}
                          </AppText>
                          {payLine ? (
                            <AppText
                              style={[
                                tennisTextStyles.sectionSubtitle,
                                { writingDirection },
                              ]}
                              maxLines={1}
                            >
                              {payLine}
                            </AppText>
                          ) : null}
                        </>
                      ) : location ? (
                        <AppText
                          style={[
                            tennisTextStyles.sectionSubtitle,
                            { writingDirection },
                          ]}
                          maxLines={1}
                        >
                          {location}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.photoHalf} pointerEvents="none">
                  <View style={styles.photoSkew}>
                    <View style={styles.photoInner}>
                      <View style={styles.photoPlaceholder}>
                        <Icon
                          name="place"
                          size={22}
                          color={tennisColors.white}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.actionRail} pointerEvents="box-none">
                  {showMessage ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("matches.hub.contactClub", {
                        club: club.name,
                      })}
                      disabled={loading}
                      onPress={() => {
                        void messageClub(club);
                      }}
                      style={({ pressed }) => [
                        styles.actionLink,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon
                        name="chat"
                        size={13}
                        color={tennisColors.primary}
                      />
                      <AppText style={styles.messageLabel} maxLines={1}>
                        {loading
                          ? t("common.loading")
                          : t("matches.hub.messageClub")}
                      </AppText>
                    </Pressable>
                  ) : (
                    <View />
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("matches.hub.openClubDetails", {
                      club: club.name,
                    })}
                    onPress={() => openClub(club)}
                    style={({ pressed }) => [
                      styles.actionLink,
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppText style={styles.viewClubLabel} maxLines={1}>
                      {t("clubs.viewDetails")}
                    </AppText>
                    <Icon name="chevron" size={12} color={tennisColors.white} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {settled && onRelease && booking ? (
        <HubDestructiveLink
          label={t("matches.hub.courtFellThrough")}
          disabled={releasing}
          onPress={onRelease}
        />
      ) : null}

      {isConfirmStage ? (
        <View style={styles.confirmFooter}>
          {noCourts ? (
            <AppText style={[styles.blocker, { writingDirection }]}>
              {t("matches.booking.bookedOffAppNoCourts")}
            </AppText>
          ) : null}

          <FigmaPrimaryButton
            label={t("matches.booking.bookedOffAppConfirm")}
            disabled={!confirmCourt || !agreedSlot || confirmMutation.isPending}
            loading={confirmMutation.isPending}
            onPress={handleConfirm}
          />

          <View style={styles.escapeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("matches.hub.clubNotListed")}
              onPress={() => router.push(matchBookExternalRoute(matchId))}
              style={({ pressed }) => [
                styles.escape,
                pressed && styles.pressed,
              ]}
            >
              <AppText style={[styles.escapeLabel, { writingDirection }]}>
                {t("matches.hub.clubNotListed")}
              </AppText>
            </Pressable>
            <AppText style={styles.escapeDot}>·</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("matches.hub.differentTime")}
              onPress={() =>
                router.push(
                  matchBookExternalRoute(matchId, {
                    clubId: selectedClubId ?? undefined,
                  }),
                )
              }
              style={({ pressed }) => [
                styles.escape,
                pressed && styles.pressed,
              ]}
            >
              <AppText style={[styles.escapeLabel, { writingDirection }]}>
                {t("matches.hub.differentTime")}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const PHOTO_PLACEHOLDER = "#E09A5C";

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  clubCard: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.lg,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    overflow: "hidden",
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 88,
    position: "relative",
  },
  infoColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-start",
    paddingTop: 12,
    paddingBottom: 36,
    paddingStart: 12,
    paddingEnd: 16,
    backgroundColor: tennisColors.background,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: tennisColors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  radioSelected: {
    borderColor: tennisColors.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tennisColors.primary,
  },
  name: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 14,
    lineHeight: 18,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
  courtName: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
    color: tennisColors.primaryDark,
  },
  actionRail: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 34,
  },
  actionLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 34,
  },
  messageLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.primary,
  },
  photoHalf: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    backgroundColor: PHOTO_PLACEHOLDER,
  },
  photoSkew: {
    flex: 1,
    marginLeft: -16,
    paddingLeft: 16,
    backgroundColor: PHOTO_PLACEHOLDER,
    transform: [{ skewX: "10deg" }],
  },
  photoInner: {
    flex: 1,
    transform: [{ skewX: "-10deg" }],
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 24,
  },
  viewClubLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.white,
  },
  pressed: {
    opacity: 0.88,
  },
  confirmFooter: {
    gap: 10,
    marginTop: 4,
  },
  blocker: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    color: tennisColors.mutedForeground,
  },
  escapeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  escape: {
    minHeight: 32,
    justifyContent: "center",
  },
  escapeLabel: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
    textDecorationLine: "underline",
  },
  escapeDot: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
});
