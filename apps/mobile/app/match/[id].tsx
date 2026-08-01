import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
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
  respondBookingAlternative,
  respondToJoinRequest,
  withdrawMatchTimeOption,
  type MatchHubTimeOption,
} from "@tennis-lebanon/api";
import {
  canCancelBookingRequest,
  canManageProposedTimes,
  canRequestCourt,
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
import { StatusBanner } from "../../src/components/AppUi";
import { MatchChatPanel } from "../../src/components/MatchChatPanel";
import { MatchResultPanel } from "../../src/components/MatchResultPanel";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  HubDestructiveLink,
  HubSummaryRow,
} from "../../src/components/match/HubSummaryRow";
import { MatchHubOverviewDetails } from "../../src/components/match/MatchHubOverviewDetails";
import { MatchHubLayout } from "../../src/components/match/MatchHubLayout";
import { PlayerProfileSection } from "../../src/components/player/PlayerProfileSection";
import {
  ChipButton,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../src/components/onboarding-ui";
import { formatUtcSlotInBeirut } from "../../src/lib/beirut-time";
import { confirmAction } from "../../src/lib/confirm-action";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { exitMatchHub } from "../../src/lib/navigation";
import {
  matchBookRoute,
  matchCancelRoute,
  matchInviteRoute,
  matchWithdrawRoute,
} from "../../src/lib/routes";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { tennisColors, tennisRadii } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
  is_creator?: boolean;
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
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<
    Partial<Record<"overview" | "vote" | "chat" | "book", number>>
  >({});
  const [activeSection, setActiveSection] = useState<
    "overview" | "vote" | "chat" | "book"
  >("overview");

  const sectionTabs = [
    { value: "overview" as const, label: t("matches.hub.sections.overview") },
    { value: "vote" as const, label: t("matches.hub.sections.vote") },
    { value: "chat" as const, label: t("matches.hub.sections.chat") },
    { value: "book" as const, label: t("matches.hub.sections.book") },
  ];

  function jumpToSection(section: "overview" | "vote" | "chat" | "book") {
    setActiveSection(section);
    const offset = sectionOffsets.current[section] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(offset - 8, 0), animated: true });
  }

  const hubQuery = useQuery({
    queryKey: ["match-hub", id],
    queryFn: () => getMatchHub(supabase, id!),
    enabled: Boolean(id),
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

  const joinAction = useMemo(() => {
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
    });
  }, [hub]);

  const agreedSlot = useMemo(() => {
    if (!hub?.selected_time_option_id) return null;
    return proposedTimes.find(
      (slot) => slot.id === hub.selected_time_option_id,
    );
  }, [hub, proposedTimes]);

  const canInvite =
    hub?.viewer_is_creator &&
    hub.participant_count < hub.capacity &&
    (hub.status === "open" || hub.status === "full" || hub.status === "draft");

  const hasAcceptedBooking = hub?.booking?.status === "accepted";

  const showLeave =
    hub?.viewer_status === "accepted" &&
    canParticipantLeave(hub.status, hub.viewer_is_creator);

  const showWithdraw =
    hub?.viewer_status === "accepted" &&
    canParticipantWithdraw(hub.status, hub.viewer_is_creator);

  const showCancel =
    hub?.viewer_is_creator && canCreatorCancelMatch(hub.status);

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
          {unanimous ? ` · ${t("matches.hub.agreedTime")}` : ""}
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

  const hubLayoutProps = {
    title: t("matches.hub.title"),
    subtitle: hub ? t(`matches.status.${hub.status}`) : undefined,
    activeSection,
    onSectionChange: jumpToSection,
    onBack: exitMatchHub,
    refreshing: hubQuery.isRefetching,
    onRefresh: () => void hubQuery.refetch(),
    scrollRef,
    sectionTabs,
  };

  if (hubQuery.isLoading) {
    return (
      <MatchHubLayout {...hubLayoutProps}>
        <ActivityIndicator
          color={tennisColors.primary}
          accessibilityLabel={t("discover.loading")}
        />
      </MatchHubLayout>
    );
  }

  return (
    <MatchHubLayout {...hubLayoutProps}>
      {hubQuery.isError ? (
        <ErrorNotice>{t("matches.hub.loadError")}</ErrorNotice>
      ) : null}

      <View
        onLayout={(event) => {
          sectionOffsets.current.overview = event.nativeEvent.layout.y;
        }}
      />

      {hub?.status === "draft" && hub.viewer_is_creator ? (
        <StatusBanner
          body={t("matches.hub.draftBanner")}
          actions={
            <FigmaPrimaryButton
              label={t("matches.hub.continueSetup")}
              onPress={() => router.push(matchInviteRoute(id!))}
            />
          }
        />
      ) : null}

      {hub?.next_action === "time_agreed" ? (
        <StatusBanner body={t("matches.hub.timeAgreed")} />
      ) : null}

      {hub?.next_action === "awaiting_club" ? (
        <StatusBanner body={t("matches.hub.awaitingClub")} />
      ) : null}

      {hub?.next_action === "pay_at_club" ? (
        <StatusBanner body={t("matches.hub.payAtClub")} />
      ) : null}

      {hub?.is_stale_warning ? (
        <StatusBanner body={t("matches.lifecycle.staleWarning")} />
      ) : null}

      {hub?.can_extend_listing ? (
        <FigmaSecondaryButton
          label={t("matches.lifecycle.extendListing")}
          disabled={extendMutation.isPending}
          onPress={() => extendMutation.mutate()}
        />
      ) : null}

      {hub &&
      canRequestCourt({
        viewerIsCreator: hub.viewer_is_creator,
        matchStatus: hub.status,
        nextAction: hub.next_action,
      }) ? (
        <FigmaPrimaryButton
          label={t("matches.hub.requestCourt")}
          onPress={() => router.push(matchBookRoute(id!))}
        />
      ) : null}

      <View
        onLayout={(event) => {
          sectionOffsets.current.book = event.nativeEvent.layout.y;
        }}
      />

      {booking ? (
        <PlayerProfileSection title={t("matches.hub.bookingTitle")}>
          <HubSummaryRow
            label={t("clubs.title")}
            value={`${booking.club_name} · ${booking.court_name}`}
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
              value={`${booking.proposed_court_name ?? ""} · ${formatUtcSlotInBeirut(
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

      {hub ? (
        <MatchHubOverviewDetails hub={hub} participants={participants} />
      ) : null}

      {canInvite ? (
        <FigmaSecondaryButton
          label={t("matches.invite.invitePlayers")}
          onPress={() => router.push(matchInviteRoute(id!))}
        />
      ) : null}

      <View
        onLayout={(event) => {
          sectionOffsets.current.vote = event.nativeEvent.layout.y;
        }}
      />

      {agreedSlot ? (
        <PlayerProfileSection title={t("matches.hub.agreedTime")}>
          <AppText style={styles.timeLabel}>
            {formatUtcSlotInBeirut(agreedSlot.starts_at, agreedSlot.ends_at)}
          </AppText>
          {showReschedule ? (
            <FigmaSecondaryButton
              label={t("matches.hub.reschedule")}
              onPress={() => router.push(`/match/${id}/reschedule`)}
            />
          ) : null}
        </PlayerProfileSection>
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

      {joinAction === "join" ? (
        <FigmaPrimaryButton
          label={t("matches.hub.join")}
          loading={joinMutation.isPending}
          onPress={() => joinMutation.mutate()}
        />
      ) : null}

      {joinAction === "request" ? (
        <FigmaPrimaryButton
          label={t("matches.hub.requestJoin")}
          loading={joinMutation.isPending}
          onPress={() => joinMutation.mutate()}
        />
      ) : null}

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

      <View
        onLayout={(event) => {
          sectionOffsets.current.chat = event.nativeEvent.layout.y;
        }}
      />

      <MatchChatPanel
        matchId={id!}
        enabled={hub?.viewer_status === "accepted"}
      />

      {hub && session?.user.id ? (
        <MatchResultPanel
          matchId={id!}
          hub={hub}
          viewerUserId={session.user.id}
        />
      ) : null}

      {showCancel ? (
        <HubDestructiveLink
          label={t("matches.hub.cancel")}
          onPress={() =>
            router.push(
              matchCancelRoute(id!, {
                status: hub!.status,
                bookingStartsAt: hub!.booking?.starts_at ?? null,
              }),
            )
          }
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
});
