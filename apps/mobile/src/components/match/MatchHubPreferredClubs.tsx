import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  MatchHubBooking,
  MatchHubCard,
  MatchPreferredClub,
} from "@tennis-lebanon/api";
import {
  answerCourtRequest,
  getClubDetail,
  getClubWhatsAppBookingLink,
  listMatchCourtRequests,
  recordCourtRequestOpened,
} from "@tennis-lebanon/api";
import type { Json } from "@tennis-lebanon/types";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { FigmaPrimaryButton, FigmaSecondaryButton } from "../onboarding-ui";
import {
  formatCompactUtcInBeirut,
  formatUtcSlotInBeirut,
} from "../../lib/beirut-time";
import { clubBookingAction } from "../../lib/club-booking-action";
import {
  latestSentCourtRequest,
  pendingCourtRequest,
} from "../../lib/court-request";
import { confirmAction, notify } from "../../lib/confirm-action";
import { useLayoutDirection } from "../../lib/layout-direction";
import { preferredClubLocationLabel } from "../../lib/match-clubs";
import { clubDetailRoute, matchBookExternalRoute } from "../../lib/routes";
import { openWhatsAppBooking } from "../../lib/whatsapp-booking";
import { useConfirmExternalCourt } from "../../hooks/useConfirmExternalCourt";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../providers/ToastProvider";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { MatchHubConfirmedHero } from "./MatchHubConfirmedHero";
import { HubDestructiveLink } from "./HubSummaryRow";
import { hubSectionStyles } from "./hub-section-styles";

type MatchHubPreferredClubsProps = {
  clubs: MatchPreferredClub[];
  matchId: string;
  isHost?: boolean;
  canConfirmCourt?: boolean;
  compact?: boolean;
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
  compact: _compact = false,
  agreedSlot = null,
  booking = null,
  onRelease,
  releasing = false,
}: MatchHubPreferredClubsProps) {
  const { t, i18n } = useTranslation();
  const { writingDirection, rowDirection } = useLayoutDirection();
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

  // Confirm stage needs a club for Message / Booked off-app. Seed the first
  // preferred club so selection is never an empty radio with a disabled CTA.
  if (
    isHost &&
    canConfirmCourt &&
    !booking &&
    !optimisticBooking &&
    selectedClubId == null &&
    clubs.length > 0
  ) {
    setSelectedClubId(clubs[0]!.club_id);
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

  const courtRequestsQuery = useQuery({
    queryKey: ["match-court-requests", matchId],
    queryFn: () => listMatchCourtRequests(supabase, matchId),
  });
  const courtRequests = courtRequestsQuery.data ?? [];
  const askedRequest = latestSentCourtRequest(courtRequests);
  const unansweredRequest = pendingCourtRequest(courtRequests, isHost);

  const answerMutation = useMutation({
    mutationFn: ({ requestId, sent }: { requestId: string; sent: boolean }) =>
      answerCourtRequest(supabase, requestId, sent),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["match-court-requests", matchId],
      });
    },
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

      // Recorded before the app backgrounds, so the "did you send it?" prompt
      // is already waiting on return — and survives the app being killed.
      // Best effort on purpose: measurement must never stop a host from
      // reaching the club.
      try {
        await recordCourtRequestOpened(supabase, matchId, club.club_id);
        void queryClient.invalidateQueries({
          queryKey: ["match-court-requests", matchId],
        });
      } catch {
        // Swallowed: the booking conversation matters more than the record.
      }

      await openWhatsAppBooking(link);
    } catch {
      notify(t("clubs.whatsappError"));
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

      <View style={styles.compactCard}>
        {visibleClubs.map((club, rowIndex) => {
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
            areaOnly: true,
          });

          return (
            <View key={club.club_id}>
              {rowIndex > 0 ? <View style={styles.compactDivider} /> : null}
              <View
                style={[
                  styles.compactRow,
                  { flexDirection: rowDirection },
                  isConfirmStage && selected && styles.compactRowSelected,
                ]}
              >
                <Pressable
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
                    styles.compactMain,
                    { flexDirection: rowDirection },
                    pressed && !settled && styles.pressed,
                  ]}
                >
                  {isConfirmStage ? (
                    <View
                      style={[styles.radio, selected && styles.radioSelected]}
                    >
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                  ) : null}
                  <AppText
                    style={[styles.compactName, { writingDirection }]}
                    maxLines={1}
                  >
                    {club.name}
                    {location ? (
                      <AppText style={styles.compactMeta}>
                        {` · ${location}`}
                      </AppText>
                    ) : null}
                  </AppText>
                </Pressable>

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
                      styles.compactMessage,
                      { flexDirection: rowDirection },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name="chat" size={13} color={tennisColors.primary} />
                    <AppText style={styles.messageLabel} maxLines={1}>
                      {loading
                        ? t("common.loading")
                        : t("matches.hub.messageClub")}
                    </AppText>
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("matches.hub.openClubDetails", {
                    club: club.name,
                  })}
                  onPress={() => openClub(club)}
                  style={({ pressed }) => [
                    styles.compactChevron,
                    showMessage && styles.compactChevronAfterMessage,
                    pressed && styles.pressed,
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon
                    name="chevron"
                    size={17}
                    color={tennisColors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {/* Everyone sees that a club was asked. A joiner who has committed to a
          time previously had no way to tell whether anything was happening. */}
      {!settled && askedRequest ? (
        <AppText style={[styles.askedLine, { writingDirection }]}>
          {t("matches.hub.courtRequestAsked", {
            club: askedRequest.club_name,
            when: formatCompactUtcInBeirut(askedRequest.opened_at),
          })}
        </AppText>
      ) : null}

      {/* Inline rather than a modal on return: it needs no app-lifecycle
          plumbing, and the state is server-side, so it is still here tomorrow. */}
      {!settled && unansweredRequest ? (
        <View style={styles.askPrompt}>
          <AppText style={[styles.askPromptText, { writingDirection }]}>
            {t("matches.hub.courtRequestPrompt", {
              club: unansweredRequest.club_name,
            })}
          </AppText>
          <View style={styles.askPromptActions}>
            <View style={styles.askPromptAction}>
              <FigmaSecondaryButton
                label={t("matches.hub.courtRequestSent")}
                disabled={answerMutation.isPending}
                onPress={() =>
                  answerMutation.mutate({
                    requestId: unansweredRequest.request_id,
                    sent: true,
                  })
                }
              />
            </View>
            <View style={styles.askPromptAction}>
              <FigmaSecondaryButton
                label={t("matches.hub.courtRequestNotSent")}
                disabled={answerMutation.isPending}
                onPress={() =>
                  answerMutation.mutate({
                    requestId: unansweredRequest.request_id,
                    sent: false,
                  })
                }
              />
            </View>
          </View>
        </View>
      ) : null}

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

const styles = createLiveSheet(() =>
  StyleSheet.create({
    compactCard: {
      backgroundColor: tennisColors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: tennisColors.border,
      overflow: "hidden",
    },
    compactRow: {
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 44,
    },
    compactRowSelected: {
      backgroundColor: tennisColors.quietFill,
    },
    compactDivider: {
      height: 1,
      backgroundColor: tennisColors.border,
    },
    compactMain: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 8,
    },
    compactName: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.headingMedium,
      fontSize: 15,
      lineHeight: 19,
      color: tennisColors.primaryDark,
    },
    compactMeta: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    compactMessage: {
      alignItems: "center",
      gap: 4,
      minHeight: 44,
      flexShrink: 0,
    },
    compactChevron: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      marginStart: 4,
    },
    compactChevronAfterMessage: {
      marginStart: 16,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: tennisColors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
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
    messageLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.primary,
    },
    pressed: {
      opacity: 0.88,
    },
    askedLine: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    askPrompt: {
      gap: 10,
      padding: 12,
      borderRadius: tennisRadii.md,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.muted,
    },
    askPromptText: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.primaryDark,
    },
    askPromptActions: {
      flexDirection: "row",
      gap: 8,
    },
    askPromptAction: {
      flex: 1,
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
  }),
);
