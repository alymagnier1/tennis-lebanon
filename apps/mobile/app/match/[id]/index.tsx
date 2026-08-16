import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelBookingRequest,
  castMatchTimeVote,
  extendMatchListing,
  getMatchHub,
  joinMatch,
  leaveMatch,
  releaseExternalCourt,
  respondBookingAlternative,
  respondToJoinRequest,
  withdrawMatchTimeOption,
  type MatchHubTimeOption,
} from "@tennis-lebanon/api";
import {
  canCancelBookingRequest,
  canManageProposedTimes,
  canConfirmExternalCourt,
  canRespondToBookingAlternative,
  canShowJoinAction,
  canRescheduleMatch,
  canVoteOnTimes,
  isFixedTimingMode,
  canCreatorCancelMatch,
  canParticipantLeave,
  canParticipantWithdraw,
  leavePolicyMessageKey,
  formatPriceMinor,
  hasUnanimousTimeYes,
} from "@tennis-lebanon/domain";
import { spacing, typography } from "@tennis-lebanon/ui";
import { StatusBanner } from "../../../src/components/AppUi";
import { MatchChatEntry } from "../../../src/components/MatchChatEntry";
import { MatchResultPanel } from "../../../src/components/MatchResultPanel";
import { AppText } from "../../../src/components/AppText";
import { SemanticBadge } from "../../../src/components/SemanticBadge";
import { ErrorNotice } from "../../../src/components/FormUi";
import {
  HubDestructiveLink,
  HubSummaryRow,
} from "../../../src/components/match/HubSummaryRow";
import { MatchHubActionBar } from "../../../src/components/match/MatchHubActionBar";
import { MatchHubOverviewDetails } from "../../../src/components/match/MatchHubOverviewDetails";
import { MatchHubConfirmedHero } from "../../../src/components/match/MatchHubConfirmedHero";
import { MatchHubReadyHero } from "../../../src/components/match/MatchHubReadyHero";
import { MatchHubPreferredClubs } from "../../../src/components/match/MatchHubPreferredClubs";
import { MatchHubPendingBookingSection } from "../../../src/components/match/MatchHubPendingBookingSection";
import { MatchHubParticipants } from "../../../src/components/match/MatchHubParticipants";
import { MatchHubMatchDetails } from "../../../src/components/match/MatchHubMatchDetails";
import { MatchHubLayout } from "../../../src/components/match/MatchHubLayout";
import { PlayerProfileSection } from "../../../src/components/player/PlayerProfileSection";
import {
  ChipButton,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../../src/components/onboarding-ui";
import { formatUtcSlotInBeirut } from "../../../src/lib/beirut-time";
import { confirmAction } from "../../../src/lib/confirm-action";
import { confirmCancelHostedMatch } from "../../../src/lib/confirm-cancel-hosted-match";
import { useLayoutDirection } from "../../../src/lib/layout-direction";
import { exitMatchHub } from "../../../src/lib/navigation";
import {
  resolveHubAgreedStartsAt,
  resolveHubHeroStartsAt,
} from "../../../src/lib/hub-agreed-time";
import { toneForMatchStatus } from "../../../src/lib/match-status-tone";
import { useToast } from "../../../src/providers/ToastProvider";
import {
  canConfirmCourtOnHub,
  isHubCourtLocked,
  isHubVsHeroStage,
  isMatchHubChatAvailable,
  isMatchHubChatLocked,
  shouldShowAgreedTimeSection,
  shouldShowDiscoveryOverview,
  shouldShowPayAtClubBanner,
  shouldShowTimeAgreedBanner,
  shouldUsePolishedHubLayout,
} from "../../../src/lib/match-hub-layout";
import {
  hubPrimaryActionLabelKey,
  resolveHubPrimaryAction,
  type HubPrimaryActionKind,
} from "../../../src/lib/hub-action-bar";
import {
  matchBookExternalRoute,
  matchBookRoute,
  matchChatRoute,
  matchInviteRoute,
  matchWithdrawRoute,
} from "../../../src/lib/routes";
import { supabase } from "../../../src/lib/supabase";
import { useMatchActivity } from "../../../src/hooks/useMatchActivity";
import { useAuth } from "../../../src/providers/AuthProvider";
import { tennisColors, tennisRadii } from "../../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../../src/hooks/useTennisFonts";

/** Court-first matches hold a court before they fill, so `confirmed` is not the
 * only state a booking can be released from. Anything from `in_progress` on has
 * either happened or not, which is attendance's business rather than booking's. */
const RELEASABLE_MATCH_STATUSES = new Set([
  "open",
  "full",
  "ready_to_book",
  "confirmed",
]);

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
  is_creator?: boolean;
  avatar_path?: string | null;
};

type HubRequest = {
  user_id: string;
  display_name: string;
  status: string;
};

export default function MatchHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const hubQuery = useQuery({
    queryKey: ["match-hub", id],
    queryFn: () => getMatchHub(supabase, id!),
    enabled: Boolean(id),
  });

  // Everyone else's changes arrive here. Without this the hub only refetched
  // when this device made the change, so a host never saw a join and a joiner
  // never saw the court get booked until they restarted the app.
  useMatchActivity({
    matchId: id,
    enabled: Boolean(id),
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      void queryClient.invalidateQueries({ queryKey: ["my-matches"] });
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
    await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
    await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });
  };

  const joinMutation = useMutation({
    mutationFn: () => joinMatch(supabase, id!),
    onSuccess: async () => {
      await invalidate();
      Alert.alert(t("matches.hub.joinSuccess"));
    },
    onError: () => Alert.alert(t("matches.hub.joinError")),
  });

  const respondMutation = useMutation({
    mutationFn: ({ userId, accept }: { userId: string; accept: boolean }) =>
      respondToJoinRequest(supabase, id!, userId, accept),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("matches.hub.respondError")),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveMatch(supabase, id!),
    onSuccess: async () => {
      await invalidate();
      exitMatchHub();
    },
    onError: () => Alert.alert(t("matches.hub.leaveError")),
  });

  const voteMutation = useMutation({
    mutationFn: ({
      timeOptionId,
      vote,
    }: {
      timeOptionId: string;
      vote: "yes" | "no";
    }) => castMatchTimeVote(supabase, id!, timeOptionId, vote),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("matches.hub.voteError")),
  });

  const withdrawMutation = useMutation({
    mutationFn: (timeOptionId: string) =>
      withdrawMatchTimeOption(supabase, timeOptionId),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("matches.hub.withdrawTimeError")),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: string) =>
      cancelBookingRequest(supabase, bookingId),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("matches.hub.cancelBookingError")),
  });

  const releaseCourtMutation = useMutation({
    mutationFn: () => releaseExternalCourt(supabase, id!),
    onSuccess: () => {
      invalidate();
      showToast(t("matches.hub.courtReleased"));
    },
    onError: () => Alert.alert(t("matches.hub.courtReleaseError")),
  });

  const alternativeMutation = useMutation({
    mutationFn: ({
      bookingId,
      accept,
    }: {
      bookingId: string;
      accept: boolean;
    }) => respondBookingAlternative(supabase, bookingId, accept),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("matches.hub.alternativeError")),
  });

  const extendMutation = useMutation({
    mutationFn: () => extendMatchListing(supabase, id!),
    onSuccess: async () => {
      await invalidate();
      Alert.alert(t("matches.lifecycle.extendSuccess"));
    },
    onError: () => Alert.alert(t("matches.lifecycle.extendError")),
  });

  const hub = hubQuery.data;
  const booking = hub?.booking ?? null;
  const participants =
    (hub?.participants as HubParticipant[] | undefined) ?? [];
  const pendingRequests =
    (hub?.pending_requests as HubRequest[] | undefined) ?? [];
  const proposedTimes = useMemo(
    () => hub?.proposed_times ?? [],
    [hub?.proposed_times],
  );

  // v1 clubs are WhatsApp: preferred-club Contact + Booked off-app replace the
  // in-app Request court CTA (queue has no staff delivery channel yet).
  const showRequestCourt = false;

  const showConfirmExternalCourt = hub
    ? canConfirmCourtOnHub(
        canConfirmExternalCourt({
          viewerIsParticipant: hub.viewer_status === "accepted",
          viewerIsCreator: hub.viewer_is_creator,
          matchStatus: hub.status,
          timingMode: hub.timing_mode,
          hasAgreedTime: Boolean(hub.selected_time_option_id),
          hasAcceptedBooking: hub.booking?.status === "accepted",
        }),
        hub.status,
      )
    : false;

  const viewerJoinAction = useMemo(() => {
    if (!hub) return "none";
    return canShowJoinAction({
      viewerStatus: hub.viewer_status,
      matchStatus: hub.status,
      requiresCreatorApproval: hub.requires_creator_approval,
    });
  }, [hub]);

  const showVoteUi = useMemo(() => {
    if (!hub) return false;
    return canVoteOnTimes({
      viewerStatus: hub.viewer_status,
      matchStatus: hub.status,
      timingMode: hub.timing_mode,
    });
  }, [hub]);

  const showManageTimes = useMemo(() => {
    if (!hub) return false;
    return canManageProposedTimes({
      viewerIsCreator: hub.viewer_is_creator,
      matchStatus: hub.status,
      timingMode: hub.timing_mode,
    });
  }, [hub]);

  // On a fixed match the host moves the time outright instead of adding
  // options for the group to vote on.
  const showReschedule = useMemo(() => {
    if (!hub) return false;
    return canRescheduleMatch({
      viewerIsCreator: hub.viewer_is_creator,
      matchStatus: hub.status,
      timingMode: hub.timing_mode,
      hasAcceptedBooking: hub.booking?.status === "accepted",
    });
  }, [hub]);

  const agreedSlot = useMemo(() => {
    if (!hub?.selected_time_option_id) return null;
    return proposedTimes.find(
      (slot) => slot.id === hub.selected_time_option_id,
    );
  }, [hub, proposedTimes]);

  const agreedStartsAt = useMemo(() => {
    if (!hub) return null;
    return resolveHubAgreedStartsAt(hub, proposedTimes);
  }, [hub, proposedTimes]);

  const canInvite =
    hub?.viewer_is_creator &&
    hub.participant_count < hub.capacity &&
    (hub.status === "open" || hub.status === "full" || hub.status === "draft");

  const hasAcceptedBooking = hub?.booking?.status === "accepted";
  const courtLocked = isHubCourtLocked(booking);
  const hasAgreedTime = Boolean(
    (courtLocked && booking?.starts_at) || agreedStartsAt,
  );
  const heroStartsAt = hub
    ? resolveHubHeroStartsAt(
        hub,
        proposedTimes,
        courtLocked ? (booking?.starts_at ?? null) : null,
      )
    : null;
  const vsHeroStage = hub
    ? isHubVsHeroStage(hub, booking, hasAgreedTime)
    : false;
  const polishedLayout = hub
    ? shouldUsePolishedHubLayout(hub, booking, hasAgreedTime)
    : false;

  const showLeave =
    hub?.viewer_status === "accepted" &&
    canParticipantLeave(hub.status, hub.viewer_is_creator);

  const showWithdraw =
    hub?.viewer_status === "accepted" &&
    canParticipantWithdraw(hub.status, hub.viewer_is_creator);

  const showCancel =
    hub?.viewer_is_creator && canCreatorCancelMatch(hub.status);

  // Gated on match status rather than comparing the slot to the clock: reading
  // the clock during render is impure, and the lifecycle already moves a started
  // match to in_progress. `release_external_court` still enforces the exact
  // `starts_at > now()` rule, and rejects a club-accepted booking -- which the
  // hub payload cannot see, since it carries no `arranged_externally`.
  const showReleaseCourt = Boolean(
    hub?.viewer_is_creator &&
    booking?.status === "accepted" &&
    RELEASABLE_MATCH_STATUSES.has(hub.status),
  );

  const primaryActionKind = useMemo((): HubPrimaryActionKind => {
    if (!hub) return "none";
    return resolveHubPrimaryAction({
      nextAction: hub.next_action,
      joinAction: viewerJoinAction,
      showRequestCourt,
      showConfirmExternalCourt,
      isDraftCreator: hub.status === "draft" && hub.viewer_is_creator,
      viewerIsCreator: hub.viewer_is_creator,
      canInvite: Boolean(canInvite),
    });
  }, [
    canInvite,
    hub,
    viewerJoinAction,
    showConfirmExternalCourt,
    showRequestCourt,
  ]);

  function handlePrimaryAction() {
    switch (primaryActionKind) {
      case "join":
      case "request_join":
        joinMutation.mutate();
        break;
      case "invite":
      case "continue_setup":
        router.push(matchInviteRoute(String(id)));
        break;
      case "request_court":
        router.push(matchBookRoute(String(id)));
        break;
      case "confirm_external_court":
        router.push(matchBookExternalRoute(String(id)));
        break;
      default:
        break;
    }
  }

  const secondaryBannerBody = useMemo(() => {
    if (!hub) return null;
    const messages: string[] = [];
    if (
      shouldShowTimeAgreedBanner(hub.next_action, hub, booking, hasAgreedTime)
    ) {
      messages.push(t("matches.hub.timeAgreed"));
    }
    if (hub.next_action === "awaiting_club") {
      messages.push(t("matches.hub.awaitingClub"));
    }
    if (shouldShowPayAtClubBanner(hub.next_action, booking)) {
      messages.push(t("matches.hub.payAtClub"));
    }
    if (hub.is_stale_warning) {
      messages.push(t("matches.lifecycle.staleWarning"));
    }
    return messages.length > 0 ? messages.join("\n") : null;
  }, [booking, hasAgreedTime, hub, t]);

  const primaryBannerBody = useMemo(() => {
    if (!hub) return null;
    if (hub.status === "draft" && hub.viewer_is_creator) {
      return t("matches.hub.draftBanner");
    }
    // Vs-hero already shows open slots; skip the duplicate awaiting banner.
    if (hub.next_action === "awaiting_players" && !vsHeroStage) {
      return hasAcceptedBooking
        ? t("matches.hub.awaitingPlayersCourtSecured")
        : t("matches.hub.awaitingPlayers");
    }
    return null;
  }, [hasAcceptedBooking, hub, t, vsHeroStage]);

  function renderTimeSlot(slot: MatchHubTimeOption) {
    const isAgreed = hub?.selected_time_option_id === slot.id;
    const unanimous = hasUnanimousTimeYes({
      yesCount: slot.yes_count,
      requiredCount: slot.required_count,
      participantCount: hub?.participant_count ?? 0,
      capacity: hub?.capacity ?? 0,
    });

    return (
      <View key={slot.id} style={styles.timeCard}>
        <AppText style={[styles.timeLabel, { writingDirection }]} maxLines={2}>
          {formatUtcSlotInBeirut(slot.starts_at, slot.ends_at)}
        </AppText>
        <AppText style={styles.timeMeta}>
          {t("matches.hub.voteCount", {
            yes: slot.yes_count,
            required: slot.required_count,
          })}
          {unanimous ? ` Â· ${t("matches.hub.agreedTime")}` : ""}
        </AppText>
        {showVoteUi ? (
          <View style={[styles.voteRow, { flexDirection: rowDirection }]}>
            <ChipButton
              label={t("matches.hub.voteYes")}
              selected={slot.viewer_vote === "yes"}
              onPress={() =>
                voteMutation.mutate({ timeOptionId: slot.id, vote: "yes" })
              }
            />
            <ChipButton
              label={t("matches.hub.voteNo")}
              selected={slot.viewer_vote === "no"}
              onPress={() =>
                voteMutation.mutate({ timeOptionId: slot.id, vote: "no" })
              }
            />
          </View>
        ) : null}
        {showManageTimes && !isAgreed ? (
          <HubDestructiveLink
            label={t("matches.hub.withdrawTime")}
            disabled={withdrawMutation.isPending}
            onPress={() => withdrawMutation.mutate(slot.id)}
          />
        ) : null}
      </View>
    );
  }

  function handleReleaseCourt() {
    confirmAction({
      title: t("matches.hub.courtFellThrough"),
      message: t("matches.hub.courtFellThroughPrompt"),
      confirmLabel: t("matches.hub.courtFellThroughConfirm"),
      cancelLabel: t("common.cancel"),
      onConfirm: () => releaseCourtMutation.mutate(),
    });
  }

  function handleCancelMatch() {
    if (!hub) return;
    confirmCancelHostedMatch(
      {
        matchId: id!,
        status: hub.status,
        participantCount: hub.participant_count,
        bookingStartsAt: hub.booking?.starts_at ?? null,
      },
      t,
      () => {
        queryClient.invalidateQueries({ queryKey: ["my-matches"] });
        queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
        exitMatchHub();
      },
    );
  }

  const chatAvailable = hub ? isMatchHubChatAvailable(hub) : false;
  const chatLocked = hub ? isMatchHubChatLocked(hub) : false;

  const hasPreferredClubs =
    Array.isArray(hub?.preferred_clubs) && hub.preferred_clubs.length > 0;

  // The preferred-clubs section owns booking, so the hero does not repeat it as
  // a primary button -- unless there are no clubs to own it, in which case the
  // hero is the only route to the confirm screen.
  const heroPrimaryKind: HubPrimaryActionKind =
    primaryActionKind === "confirm_external_court" && hasPreferredClubs
      ? "none"
      : primaryActionKind;
  const primaryActionLabelKey = hubPrimaryActionLabelKey(heroPrimaryKind);
  const actionsInReadyHero = Boolean(
    vsHeroStage && hub && heroPrimaryKind !== "none",
  );

  const [pullRefreshing, setPullRefreshing] = useState(false);

  const hubLayoutProps = {
    title: t("matches.hub.title"),
    statusSlot: hub ? (
      <SemanticBadge
        label={t(`matches.status.${hub.status}`)}
        tone={toneForMatchStatus(hub.status)}
      />
    ) : undefined,
    onBack: exitMatchHub,
    // Only user pull-to-refresh â€” background invalidate after confirm was
    // flashing RefreshControl and reading as a full-screen flicker.
    refreshing: pullRefreshing,
    onRefresh: () => {
      setPullRefreshing(true);
      void hubQuery.refetch().finally(() => setPullRefreshing(false));
    },
    footer:
      !actionsInReadyHero &&
      hub &&
      (primaryActionKind !== "none" || showCancel) ? (
        <MatchHubActionBar
          actionKind={primaryActionKind}
          loading={joinMutation.isPending}
          onPress={handlePrimaryAction}
          cancelLabel={showCancel ? t("matches.hub.cancel") : undefined}
          onCancel={showCancel ? handleCancelMatch : undefined}
        />
      ) : null,
  };

  if (hubQuery.isLoading) {
    return (
      <MatchHubLayout {...hubLayoutProps}>
        <ActivityIndicator
          color={tennisColors.primary}
          accessibilityLabel={t("common.loading")}
        />
      </MatchHubLayout>
    );
  }

  return (
    <MatchHubLayout {...hubLayoutProps}>
      {hubQuery.isError ? (
        <ErrorNotice>{t("matches.hub.loadError")}</ErrorNotice>
      ) : null}

      {primaryBannerBody ? (
        <StatusBanner body={primaryBannerBody} tone="actionable" />
      ) : null}

      {secondaryBannerBody ? (
        <StatusBanner body={secondaryBannerBody} tone="info" />
      ) : null}

      {hub?.can_extend_listing ? (
        <FigmaSecondaryButton
          label={t("matches.lifecycle.extendListing")}
          disabled={extendMutation.isPending}
          onPress={() => extendMutation.mutate()}
        />
      ) : null}

      {vsHeroStage && hub ? (
        <MatchHubReadyHero
          hub={hub}
          participants={participants}
          startsAt={heroStartsAt}
          onReschedule={
            showReschedule
              ? () => router.push(`/match/${id}/reschedule`)
              : undefined
          }
          primaryLabel={
            primaryActionLabelKey ? t(primaryActionLabelKey) : undefined
          }
          primaryLoading={
            heroPrimaryKind === "join" || heroPrimaryKind === "request_join"
              ? joinMutation.isPending
              : false
          }
          onPrimary={
            heroPrimaryKind !== "none" ? handlePrimaryAction : undefined
          }
        />
      ) : null}

      {vsHeroStage && hasPreferredClubs ? (
        <MatchHubPreferredClubs
          clubs={hub!.preferred_clubs}
          matchId={id!}
          isHost={hub!.viewer_is_creator}
          canConfirmCourt={showConfirmExternalCourt}
          agreedSlot={agreedSlot ?? null}
          booking={courtLocked ? booking : null}
          releasing={releaseCourtMutation.isPending}
          onRelease={showReleaseCourt ? handleReleaseCourt : undefined}
        />
      ) : courtLocked && booking ? (
        <MatchHubConfirmedHero
          booking={booking}
          matchId={id!}
          releasing={releaseCourtMutation.isPending}
          onRelease={showReleaseCourt ? handleReleaseCourt : undefined}
        />
      ) : null}

      {hub?.notes && polishedLayout ? (
        <AppText style={[styles.hubNotes, { writingDirection }]}>
          {hub.notes}
        </AppText>
      ) : null}

      {booking && !courtLocked && polishedLayout ? (
        <MatchHubPendingBookingSection
          booking={booking}
          hub={hub!}
          onCancelBooking={() =>
            cancelBookingMutation.mutate(booking.booking_id)
          }
          onAcceptAlternative={() =>
            alternativeMutation.mutate({
              bookingId: booking.booking_id,
              accept: true,
            })
          }
          onDeclineAlternative={() =>
            alternativeMutation.mutate({
              bookingId: booking.booking_id,
              accept: false,
            })
          }
          alternativePending={alternativeMutation.isPending}
        />
      ) : null}

      {booking && !courtLocked && !polishedLayout ? (
        <PlayerProfileSection title={t("matches.hub.bookingTitle")}>
          <HubSummaryRow
            label={t("clubs.title")}
            value={`${booking.club_name} Â· ${booking.court_name}`}
          />
          <HubSummaryRow
            label={t("matches.booking.confirmTime")}
            value={formatUtcSlotInBeirut(booking.starts_at, booking.ends_at)}
          />
          <HubSummaryRow
            label={t("matches.hub.bookingStatus")}
            value={
              booking.status === "requested"
                ? t("matches.hub.bookingRequested")
                : booking.status === "accepted"
                  ? t("matches.hub.bookingAccepted")
                  : booking.status === "alternative_proposed"
                    ? t("matches.hub.bookingAlternative")
                    : booking.status
            }
          />
          {formatPriceMinor(booking.price_minor, booking.currency) ? (
            <HubSummaryRow
              label={t("clubs.payAtClub")}
              value={formatPriceMinor(booking.price_minor, booking.currency)!}
            />
          ) : null}
          {booking.status === "alternative_proposed" &&
          booking.proposed_start_at &&
          booking.proposed_end_at ? (
            <HubSummaryRow
              label={t("matches.hub.bookingAlternative")}
              value={`${booking.proposed_court_name ?? ""} Â· ${formatUtcSlotInBeirut(
                booking.proposed_start_at,
                booking.proposed_end_at,
              )}`}
            />
          ) : null}
          {booking.club_note ? (
            <AppText style={styles.timeMeta}>{booking.club_note}</AppText>
          ) : null}

          {hub &&
          canCancelBookingRequest({
            viewerIsCreator: hub.viewer_is_creator,
            bookingStatus: booking.status,
          }) ? (
            <HubDestructiveLink
              label={t("matches.hub.cancelBooking")}
              onPress={() => cancelBookingMutation.mutate(booking.booking_id)}
            />
          ) : null}

          {hub &&
          canRespondToBookingAlternative({
            viewerIsCreator: hub.viewer_is_creator,
            bookingStatus: booking.status,
          }) ? (
            <View style={styles.inlineActions}>
              <View style={styles.inlineAction}>
                <FigmaPrimaryButton
                  label={t("matches.hub.acceptAlternative")}
                  onPress={() =>
                    alternativeMutation.mutate({
                      bookingId: booking.booking_id,
                      accept: true,
                    })
                  }
                />
              </View>
              <View style={styles.inlineAction}>
                <FigmaSecondaryButton
                  label={t("matches.hub.declineAlternative")}
                  disabled={alternativeMutation.isPending}
                  onPress={() =>
                    alternativeMutation.mutate({
                      bookingId: booking.booking_id,
                      accept: false,
                    })
                  }
                />
              </View>
            </View>
          ) : null}
        </PlayerProfileSection>
      ) : null}

      {hub && shouldShowDiscoveryOverview(hub, booking, hasAgreedTime) ? (
        <MatchHubOverviewDetails hub={hub} />
      ) : null}

      {participants.length > 0 && !vsHeroStage ? (
        <MatchHubParticipants participants={participants} />
      ) : null}

      {canInvite && !actionsInReadyHero ? (
        <FigmaSecondaryButton
          label={t("matches.invite.invitePlayers")}
          onPress={() => router.push(matchInviteRoute(String(id)))}
        />
      ) : null}

      {!isFixedTimingMode(hub?.timing_mode) && proposedTimes.length > 0 ? (
        <PlayerProfileSection title={t("matches.hub.proposedTimes")}>
          {showVoteUi ? (
            <AppText style={styles.timeMeta}>
              {t("matches.hub.votePrompt")}
            </AppText>
          ) : null}
          {showManageTimes && proposedTimes.length < 3 ? (
            <FigmaSecondaryButton
              label={t("matches.hub.addAnotherTime")}
              onPress={() => router.push(`/match/${id}/add-time`)}
            />
          ) : null}
          {proposedTimes.map((slot) => renderTimeSlot(slot))}
        </PlayerProfileSection>
      ) : null}

      {hub?.viewer_is_creator && pendingRequests.length > 0 ? (
        <PlayerProfileSection title={t("matches.hub.pendingRequests")}>
          {pendingRequests.map((request) => (
            <View key={request.user_id} style={styles.requestCard}>
              <AppText style={styles.participantName} maxLines={1}>
                {request.display_name}
              </AppText>
              <View
                style={[styles.requestActions, { flexDirection: rowDirection }]}
              >
                <View style={styles.inlineAction}>
                  <FigmaPrimaryButton
                    label={t("matches.hub.approve")}
                    onPress={() =>
                      respondMutation.mutate({
                        userId: request.user_id,
                        accept: true,
                      })
                    }
                  />
                </View>
                <View style={styles.inlineAction}>
                  <FigmaSecondaryButton
                    label={t("matches.hub.reject")}
                    onPress={() =>
                      respondMutation.mutate({
                        userId: request.user_id,
                        accept: false,
                      })
                    }
                  />
                </View>
              </View>
            </View>
          ))}
        </PlayerProfileSection>
      ) : null}

      {hub && shouldShowAgreedTimeSection(Boolean(agreedSlot), hub, booking) ? (
        <PlayerProfileSection title={t("matches.hub.agreedTime")}>
          <AppText style={styles.timeLabel}>
            {formatUtcSlotInBeirut(agreedSlot!.starts_at, agreedSlot!.ends_at)}
          </AppText>
          {showReschedule ? (
            <FigmaSecondaryButton
              label={t("matches.hub.reschedule")}
              onPress={() => router.push(`/match/${id}/reschedule`)}
            />
          ) : null}
        </PlayerProfileSection>
      ) : null}

      {courtLocked && hub && !vsHeroStage ? (
        <MatchHubMatchDetails hub={hub} />
      ) : null}

      <MatchChatEntry
        matchId={id!}
        enabled={chatAvailable}
        locked={chatLocked}
        onPress={() => router.push(matchChatRoute(id!))}
      />

      {showWithdraw ? (
        <HubDestructiveLink
          label={t("matches.hub.withdraw")}
          onPress={() => router.push(matchWithdrawRoute(id!))}
        />
      ) : null}

      {showLeave ? (
        <HubDestructiveLink
          label={t("matches.hub.leave")}
          onPress={() =>
            confirmAction({
              title: t("matches.hub.leave"),
              message: t(
                leavePolicyMessageKey(hub!.status, hasAcceptedBooking),
                { hours: 24 },
              ),
              confirmLabel: t("matches.hub.leave"),
              cancelLabel: t("common.cancel"),
              onConfirm: () => leaveMutation.mutate(),
            })
          }
        />
      ) : null}

      {hub && session?.user.id ? (
        <MatchResultPanel
          matchId={id!}
          hub={hub}
          viewerUserId={session.user.id}
        />
      ) : null}

      {/*
        Cancelling used to sit beside the primary action in the ready hero, at
        equal weight. In the other stages the footer action bar still carries
        it, so this covers the hero stage only.
      */}
      {showCancel && actionsInReadyHero ? (
        <HubDestructiveLink
          label={t("matches.hub.cancel")}
          onPress={handleCancelMatch}
        />
      ) : null}
    </MatchHubLayout>
  );
}

const styles = StyleSheet.create({
  participantRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  participantText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  participantName: {
    fontFamily: tennisFontFamily.bodyMedium,
    color: tennisColors.primaryDark,
    fontSize: typography.size.md,
  },
  participantMeta: {
    fontFamily: tennisFontFamily.body,
    color: tennisColors.mutedForeground,
    fontSize: typography.size.sm,
  },
  timeCard: {
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    borderRadius: tennisRadii.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: tennisColors.muted,
  },
  timeLabel: {
    fontFamily: tennisFontFamily.headingSemi,
    color: tennisColors.primaryDark,
    fontSize: typography.size.sm,
  },
  timeMeta: {
    fontFamily: tennisFontFamily.body,
    color: tennisColors.mutedForeground,
    fontSize: typography.size.xs,
  },
  voteRow: {
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  requestCard: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  requestActions: {
    gap: spacing.sm,
  },
  inlineActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  inlineAction: {
    flex: 1,
  },
  bookingActions: {
    gap: spacing.sm,
  },
  hubNotes: {
    fontFamily: tennisFontFamily.body,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: tennisColors.primaryDark,
  },
});
