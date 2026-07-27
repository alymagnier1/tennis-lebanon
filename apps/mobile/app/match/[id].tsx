import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelBookingRequest,
  cancelMatch,
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
  canVoteOnTimes,
  canCreatorCancelBeforeBooking,
  formatPriceMinor,
  hasUnanimousTimeYes,
} from "@tennis-lebanon/domain";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { SectionTitle, StatusBanner } from "../../src/components/AppUi";
import { MatchChatPanel } from "../../src/components/MatchChatPanel";
import { MatchResultPanel } from "../../src/components/MatchResultPanel";
import { AppText } from "../../src/components/AppText";
import {
  DestructiveButton,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SummaryRow,
  formStyles,
} from "../../src/components/FormUi";
import { formatUtcSlotInBeirut } from "../../src/lib/beirut-time";
import { confirmAction } from "../../src/lib/confirm-action";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { exitMatchHub } from "../../src/lib/navigation";
import { matchBookRoute, matchInviteRoute } from "../../src/lib/routes";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

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

function VoteChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.voteChip,
        selected && styles.voteChipSelected,
        disabled && styles.voteChipDisabled,
        pressed && !disabled && styles.voteChipPressed,
      ]}
    >
      <AppText
        style={[styles.voteChipText, selected && styles.voteChipTextSelected]}
        maxLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export default function MatchHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const { session } = useAuth();
  const queryClient = useQueryClient();

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

  const cancelMutation = useMutation({
    mutationFn: () => cancelMatch(supabase, id!),
    onSuccess: async () => {
      await invalidate();
      exitMatchHub();
    },
    onError: () => Alert.alert(t("matches.hub.cancelError")),
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
    mutationFn: (bookingId: string) => cancelBookingRequest(supabase, bookingId),
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
    });
  }, [hub]);

  const showManageTimes = useMemo(() => {
    if (!hub) return false;
    return canManageProposedTimes({
      viewerIsCreator: hub.viewer_is_creator,
      matchStatus: hub.status,
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

  const showLeave =
    hub?.viewer_status === "accepted" && !hub.viewer_is_creator;

  const showCancel =
    hub?.viewer_is_creator && canCreatorCancelBeforeBooking(hub.status);

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
            <VoteChip
              label={t("matches.hub.voteYes")}
              selected={slot.viewer_vote === "yes"}
              disabled={voteMutation.isPending || slot.viewer_vote === "yes"}
              onPress={() =>
                voteMutation.mutate({ timeOptionId: slot.id, vote: "yes" })
              }
            />
            <VoteChip
              label={t("matches.hub.voteNo")}
              selected={slot.viewer_vote === "no"}
              disabled={voteMutation.isPending || slot.viewer_vote === "no"}
              onPress={() =>
                voteMutation.mutate({ timeOptionId: slot.id, vote: "no" })
              }
            />
          </View>
        ) : null}
        {showManageTimes && !isAgreed ? (
          <DestructiveButton
            label={t("matches.hub.withdrawTime")}
            disabled={withdrawMutation.isPending}
            loading={withdrawMutation.isPending}
            onPress={() => withdrawMutation.mutate(slot.id)}
          />
        ) : null}
      </View>
    );
  }

  if (hubQuery.isLoading) {
    return (
      <Screen title={t("matches.hub.title")}>
        <ActivityIndicator accessibilityLabel={t("discover.loading")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("matches.hub.title")}
      description={
        hub ? t(`matches.status.${hub.status}`) : undefined
      }
      refreshing={hubQuery.isRefetching}
      onRefresh={() => void hubQuery.refetch()}
      contentGrow={false}
    >
      {hubQuery.isError ? (
        <AppText style={formStyles.errorText}>
          {t("matches.hub.loadError")}
        </AppText>
      ) : null}

      {hub?.status === "draft" && hub.viewer_is_creator ? (
        <StatusBanner
          body={t("matches.hub.draftBanner")}
          actions={
            <PrimaryButton
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
        <PrimaryButton
          label={t("matches.lifecycle.extendListing")}
          loading={extendMutation.isPending}
          onPress={() => extendMutation.mutate()}
        />
      ) : null}

      {hub &&
      canRequestCourt({
        viewerIsCreator: hub.viewer_is_creator,
        matchStatus: hub.status,
        nextAction: hub.next_action,
      }) ? (
        <PrimaryButton
          label={t("matches.hub.requestCourt")}
          onPress={() => router.push(matchBookRoute(id!))}
        />
      ) : null}

      {booking ? (
        <View style={formStyles.compactCard}>
          <AppText style={formStyles.compactCardTitle}>
            {t("matches.hub.bookingTitle")}
          </AppText>
          <SummaryRow
            label={t("clubs.title")}
            value={`${booking.club_name} · ${booking.court_name}`}
          />
          <SummaryRow
            label={t("matches.booking.confirmTime")}
            value={formatUtcSlotInBeirut(booking.starts_at, booking.ends_at)}
          />
          <SummaryRow
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
            <SummaryRow
              label={t("clubs.payAtClub")}
              value={formatPriceMinor(booking.price_minor, booking.currency)!}
            />
          ) : null}
          {booking.status === "alternative_proposed" &&
          booking.proposed_start_at &&
          booking.proposed_end_at ? (
            <SummaryRow
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
            <DestructiveButton
              label={t("matches.hub.cancelBooking")}
              loading={cancelBookingMutation.isPending}
              onPress={() => cancelBookingMutation.mutate(booking.booking_id)}
            />
          ) : null}

          {hub &&
          canRespondToBookingAlternative({
            viewerIsCreator: hub.viewer_is_creator,
            bookingStatus: booking.status,
          }) ? (
            <View style={formStyles.stack}>
              <PrimaryButton
                label={t("matches.hub.acceptAlternative")}
                loading={alternativeMutation.isPending}
                onPress={() =>
                  alternativeMutation.mutate({
                    bookingId: booking.booking_id,
                    accept: true,
                  })
                }
              />
              <SecondaryButton
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
          ) : null}
        </View>
      ) : null}

      {hub ? (
        <View style={formStyles.compactCard}>
          <AppText style={formStyles.compactCardTitle}>
            {t("matches.hub.summaryTitle")}
          </AppText>
          <SummaryRow
            label={t("discover.formatFilter")}
            value={`${t(`formats.${hub.format}`)} · ${hub.creator_display_name}`}
          />
          <SummaryRow
            label={t("matches.hub.participants")}
            value={`${hub.participant_count}/${hub.capacity}`}
          />
          {hub.notes ? (
            <SummaryRow
              label={t("matches.create.notes")}
              value={hub.notes}
            />
          ) : null}
        </View>
      ) : null}

      {canInvite ? (
        <PrimaryButton
          label={t("matches.invite.invitePlayers")}
          onPress={() => router.push(matchInviteRoute(id!))}
        />
      ) : null}

      {participants.length > 0 ? (
        <View style={formStyles.compactCard}>
          <SectionTitle title={t("matches.hub.participants")} />
          {participants.map((participant) => (
            <View
              key={participant.user_id}
              style={[styles.participantRow, { flexDirection: rowDirection }]}
            >
              <View style={styles.participantText}>
                <AppText style={styles.participantName} maxLines={1}>
                  {participant.display_name}
                </AppText>
                <AppText style={styles.participantMeta} maxLines={1}>
                  {[
                    participant.is_creator
                      ? t("matches.hub.hostBadge")
                      : null,
                    t(`matches.participantStatus.${participant.status}`),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {agreedSlot ? (
        <View style={formStyles.compactCard}>
          <SectionTitle title={t("matches.hub.agreedTime")} />
          <AppText style={styles.timeLabel}>
            {formatUtcSlotInBeirut(agreedSlot.starts_at, agreedSlot.ends_at)}
          </AppText>
        </View>
      ) : null}

      {proposedTimes.length > 0 ? (
        <View style={formStyles.stack}>
          <SectionTitle
            title={t("matches.hub.proposedTimes")}
            subtitle={showVoteUi ? t("matches.hub.votePrompt") : undefined}
          />
          {showManageTimes && proposedTimes.length < 3 ? (
            <SecondaryButton
              label={t("matches.hub.addAnotherTime")}
              onPress={() => router.push(`/match/${id}/add-time`)}
            />
          ) : null}
          {proposedTimes.map((slot) => renderTimeSlot(slot))}
        </View>
      ) : null}

      {hub?.viewer_is_creator && pendingRequests.length > 0 ? (
        <View style={formStyles.stack}>
          <SectionTitle title={t("matches.hub.pendingRequests")} />
          {pendingRequests.map((request) => (
            <View key={request.user_id} style={styles.requestCard}>
              <AppText style={styles.participantName} maxLines={1}>
                {request.display_name}
              </AppText>
              <View style={[styles.requestActions, { flexDirection: rowDirection }]}>
                <View style={formStyles.flex}>
                  <PrimaryButton
                    label={t("matches.hub.approve")}
                    onPress={() =>
                      respondMutation.mutate({
                        userId: request.user_id,
                        accept: true,
                      })
                    }
                  />
                </View>
                <View style={formStyles.flex}>
                  <SecondaryButton
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
        </View>
      ) : null}

      {joinAction === "join" ? (
        <PrimaryButton
          label={t("matches.hub.join")}
          loading={joinMutation.isPending}
          onPress={() => joinMutation.mutate()}
        />
      ) : null}

      {joinAction === "request" ? (
        <PrimaryButton
          label={t("matches.hub.requestJoin")}
          loading={joinMutation.isPending}
          onPress={() => joinMutation.mutate()}
        />
      ) : null}

      {showLeave ? (
        <DestructiveButton
          label={t("matches.hub.leave")}
          loading={leaveMutation.isPending}
          onPress={() =>
            confirmAction({
              title: t("matches.hub.leave"),
              message: t("matches.hub.leaveDescription"),
              confirmLabel: t("matches.hub.leave"),
              cancelLabel: t("common.cancel"),
              onConfirm: () => leaveMutation.mutate(),
            })
          }
        />
      ) : null}

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
        <DestructiveButton
          label={t("matches.hub.cancel")}
          loading={cancelMutation.isPending}
          onPress={() =>
            confirmAction({
              title: t("matches.hub.cancel"),
              message: t("matches.hub.cancelDescription"),
              confirmLabel: t("matches.hub.cancel"),
              cancelLabel: t("common.cancel"),
              onConfirm: () => cancelMutation.mutate(),
            })
          }
        />
      ) : null}
    </Screen>
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
    color: colors.neutral[900],
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  participantMeta: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
  },
  timeCard: {
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
  },
  timeLabel: {
    color: colors.neutral[900],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  timeMeta: {
    color: colors.neutral[500],
    fontSize: typography.size.xs,
  },
  voteRow: {
    gap: spacing.sm,
  },
  voteChip: {
    minWidth: 64,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
  },
  voteChipSelected: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  voteChipDisabled: {
    opacity: 0.6,
  },
  voteChipPressed: {
    opacity: 0.85,
  },
  voteChipText: {
    color: colors.neutral[700],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  voteChipTextSelected: {
    color: colors.brand[700],
    fontWeight: typography.weight.semibold,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
  },
  requestActions: {
    gap: spacing.sm,
  },
});
