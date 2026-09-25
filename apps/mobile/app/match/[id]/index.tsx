import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import { createLiveSheet } from "../../../src/theme/create-live-sheet";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelBookingRequest,
  cancelMatchInvite,
  castMatchTimeVote,
  extendMatchListing,
  getMatchHub,
  joinMatch,
  leaveMatch,
  releaseExternalCourt,
  removeMatchParticipant,
  respondBookingAlternative,
  respondToJoinRequest,
  withdrawJoinRequest,
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
  canHostRemoveParticipant,
  canParticipantLeave,
  canParticipantWithdraw,
  HOST_REMOVAL_REASONS,
  hostRemovalNeedsStartWarning,
  isHostRemovalReason,
  leavePolicyMessageKey,
  formatPriceMinor,
  hasUnanimousTimeYes,
  PLAYER_NOTE_MAX,
  sanitizePlayerNote,
  viewerMayInvite,
} from "@tennis-lebanon/domain";
import { spacing, typography } from "@tennis-lebanon/ui";
import { StatusBanner } from "../../../src/components/AppUi";
import { MatchChatEntry } from "../../../src/components/MatchChatEntry";
import { MatchResultPanel } from "../../../src/components/MatchResultPanel";
import { AppText } from "../../../src/components/AppText";
import { SemanticBadge } from "../../../src/components/SemanticBadge";
import { ScreenError } from "../../../src/components/FormUi";
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
import { MatchHubMoreSection } from "../../../src/components/match/MatchHubMoreSection";
import { MatchHubLayout } from "../../../src/components/match/MatchHubLayout";
import { MatchHubJoinRequestCarousel } from "../../../src/components/match/MatchHubJoinRequestCarousel";
import { MatchHubInvitedList } from "../../../src/components/match/MatchHubInvitedList";
import { MatchPushNudge } from "../../../src/components/match/MatchPushNudge";
import { MatchRematchCard } from "../../../src/components/match/MatchRematchCard";
import { PlayerProfileSection } from "../../../src/components/player/PlayerProfileSection";
import {
  ChipButton,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../../src/components/onboarding-ui";
import {
  formatUtcSlotInBeirut,
  formatHubTitleInBeirut,
} from "../../../src/lib/beirut-time";
import {
  confirmAction,
  notify,
  presentRemoveParticipantDialog,
} from "../../../src/lib/confirm-action";
import { confirmCancelHostedMatch } from "../../../src/lib/confirm-cancel-hosted-match";
import {
  joinErrorKey,
  respondRequestErrorKey,
} from "../../../src/lib/join-error";
import { removeParticipantErrorKey } from "../../../src/lib/remove-participant-error";
import { useLayoutDirection } from "../../../src/lib/layout-direction";
import { exitMatchHub } from "../../../src/lib/navigation";
import {
  resolveHubAgreedStartsAt,
  resolveHubHeroStartsAt,
} from "../../../src/lib/hub-agreed-time";
import { toneForMatchStatus } from "../../../src/lib/match-status-tone";
import { trackRematch } from "../../../src/lib/analytics";
import {
  beginRematch,
  canOfferRematch,
  resolveRematchOpponents,
  type RematchOpponent,
} from "../../../src/lib/rematch-draft";
import { useToast } from "../../../src/providers/ToastProvider";
import {
  canConfirmCourtOnHub,
  isHubCourtLocked,
  isHubVsHeroStage,
  isMatchHubChatAvailable,
  isMatchHubChatLocked,
  joinerHubIntentCopyKey,
  preferredClubsBeforePeoplePipeline,
  shouldShowAgreedTimeSection,
  shouldShowDiscoveryOverview,
  shouldShowPayAtClubBanner,
  shouldShowTimeAgreedBanner,
  shouldUseCompactPreferredClubs,
  shouldUsePolishedHubLayout,
} from "../../../src/lib/match-hub-layout";
import {
  hubChromeShowsInReadyHero,
  hubPrimaryActionLabelKey,
  resolveHubChromeAction,
  resolveHubFooterAction,
  resolveHubPrimaryAction,
  type HubPrimaryActionKind,
} from "../../../src/lib/hub-action-bar";
import {
  hubOpenSpotCount,
  pickHubSlotOccupant,
  pickHubVsSides,
  type HubVsParticipant,
} from "../../../src/lib/match-hub-ready-hero";
import {
  CREATE_MATCH_ROUTE,
  matchBookExternalRoute,
  matchBookRoute,
  matchChatRoute,
  matchInviteRoute,
  matchWithdrawRoute,
} from "../../../src/lib/routes";
import { supabase } from "../../../src/lib/supabase";
import { useMatchActivity } from "../../../src/hooks/useMatchActivity";
import { useAuth } from "../../../src/providers/AuthProvider";
import {
  tennisColors,
  tennisRadii,
  tennisSpacing,
  type SemanticTone,
} from "../../../src/theme/tennis-tokens";
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

type HubInvited = {
  user_id: string;
  display_name: string;
  status: string;
  avatar_path?: string | null;
};

type HubRequest = {
  user_id: string;
  display_name: string;
  status: string;
  join_note?: string | null;
  avatar_path?: string | null;
};

export default function MatchHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [joinNote, setJoinNote] = useState("");

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
    mutationFn: () => {
      const card = hubQuery.data;
      const wantsNote =
        card?.requires_creator_approval === true ||
        card?.next_action === "request_to_join";
      return joinMatch(
        supabase,
        id!,
        wantsNote ? sanitizePlayerNote(joinNote) : null,
      );
    },
    // `join_match` answers with the row it wrote, so an approval-gated match
    // reports `requested` rather than `accepted`. Saying "you joined" to
    // someone still waiting on the host is what made the pending state read as
    // a confirmed one.
    onSuccess: async (participantStatus) => {
      setJoinNote("");
      await invalidate();
      notify(
        participantStatus === "requested"
          ? t("matches.hub.requestSentSuccess")
          : t("matches.hub.joinSuccess"),
      );
    },
    onError: (error: unknown) => notify(t(joinErrorKey(error))),
  });

  const respondMutation = useMutation({
    mutationFn: ({ userId, accept }: { userId: string; accept: boolean }) =>
      respondToJoinRequest(supabase, id!, userId, accept),
    onSuccess: invalidate,
    // `match_full` is the failure a host hits routinely, because nothing
    // declines a pending request when the roster fills. The generic copy named
    // no cause and implied a retry that cannot work.
    onError: (error: unknown) => notify(t(respondRequestErrorKey(error))),
  });

  // Takes the player, not an invitation id: `invited_players` carries no id,
  // and the host is thinking "stop asking this person", not "revoke row 4f2c".
  const cancelInviteMutation = useMutation({
    mutationFn: (invitedUserId: string) =>
      cancelMatchInvite(supabase, id!, invitedUserId),
    onSuccess: invalidate,
    onError: () => notify(t("matches.hub.cancelInviteError")),
  });

  // A pending request had no way out: `leave_match` refuses anything that is
  // not `accepted`, so the asker was stuck waiting for an answer they could no
  // longer decline to wait for.
  const withdrawRequestMutation = useMutation({
    mutationFn: () => withdrawJoinRequest(supabase, id!),
    onSuccess: async () => {
      await invalidate();
      exitMatchHub();
    },
    onError: () => notify(t("matches.hub.withdrawRequestError")),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveMatch(supabase, id!),
    onSuccess: async () => {
      await invalidate();
      exitMatchHub();
    },
    onError: () => notify(t("matches.hub.leaveError")),
  });

  const removePlayerMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      removeMatchParticipant(supabase, id!, userId, reason),
    onSuccess: () => {
      invalidate();
      showToast(t("matches.hub.removeSuccess"));
    },
    onError: (error: unknown) => notify(t(removeParticipantErrorKey(error))),
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
    onError: () => notify(t("matches.hub.voteError")),
  });

  const withdrawMutation = useMutation({
    mutationFn: (timeOptionId: string) =>
      withdrawMatchTimeOption(supabase, timeOptionId),
    onSuccess: invalidate,
    onError: () => notify(t("matches.hub.withdrawTimeError")),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: string) =>
      cancelBookingRequest(supabase, bookingId),
    onSuccess: invalidate,
    onError: () => notify(t("matches.hub.cancelBookingError")),
  });

  const releaseCourtMutation = useMutation({
    mutationFn: () => releaseExternalCourt(supabase, id!),
    onSuccess: () => {
      invalidate();
      showToast(t("matches.hub.courtReleased"));
    },
    onError: () => notify(t("matches.hub.courtReleaseError")),
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
    onError: () => notify(t("matches.hub.alternativeError")),
  });

  const extendMutation = useMutation({
    mutationFn: () => extendMatchListing(supabase, id!),
    onSuccess: async () => {
      await invalidate();
      notify(t("matches.lifecycle.extendSuccess"));
    },
    onError: () => notify(t("matches.lifecycle.extendError")),
  });

  const hub = hubQuery.data;
  const booking = hub?.booking ?? null;
  const participants =
    (hub?.participants as HubParticipant[] | undefined) ?? [];
  const pendingRequests =
    (hub?.pending_requests as HubRequest[] | undefined) ?? [];
  const invitedPlayers =
    (hub?.invited_players as HubInvited[] | undefined) ?? [];
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

  // The capacity and status checks moved into viewerMayInvite with the
  // participant rule, so all three live where the server rule is mirrored.
  const canInvite = Boolean(hub && viewerMayInvite(hub));

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
  const compactPreferredClubs = shouldUseCompactPreferredClubs({
    vsHeroStage,
    canConfirmCourt: showConfirmExternalCourt,
    courtLocked,
  });
  const slotOccupant = hub?.viewer_is_creator
    ? pickHubSlotOccupant(
        pendingRequests,
        hubOpenSpotCount(pickHubVsSides(participants, hub.capacity)),
      )
    : null;
  const heroEndsAt = courtLocked
    ? (booking?.ends_at ?? null)
    : (agreedSlot?.ends_at ??
      proposedTimes.find((slot) => slot.starts_at === heroStartsAt)?.ends_at ??
      null);
  const hubTitle = heroStartsAt
    ? formatHubTitleInBeirut(
        heroStartsAt,
        i18n.resolvedLanguage ?? i18n.language,
      )
    : t("matches.hub.title");

  const showLeave =
    hub?.viewer_status === "accepted" &&
    canParticipantLeave(hub.status, hub.viewer_is_creator);

  const joinerIntentKey = hub
    ? joinerHubIntentCopyKey({
        viewerIsCreator: hub.viewer_is_creator,
        viewerStatus: hub.viewer_status,
        nextAction: hub.next_action,
      })
    : null;

  function handleRemovePlayer(player: HubVsParticipant) {
    if (!hub) return;
    if (
      !canHostRemoveParticipant({
        viewerIsCreator: hub.viewer_is_creator,
        matchStatus: hub.status,
        targetIsCreator: Boolean(player.is_creator),
        targetStatus: player.status,
        startsAt: heroStartsAt,
      })
    ) {
      return;
    }

    presentRemoveParticipantDialog({
      title: t("matches.hub.removeSheetTitle", { name: player.display_name }),
      message: t("matches.hub.removeSheetBody"),
      warning: hostRemovalNeedsStartWarning(heroStartsAt)
        ? t("matches.hub.removeSheetWarning")
        : undefined,
      reasonLabel: t("matches.hub.removeReasonLabel"),
      reasons: HOST_REMOVAL_REASONS.map((value) => ({
        value,
        label: t(`matches.hub.removeReasons.${value}`),
      })),
      reasonRequiredMessage: t("matches.hub.removeReasonRequired"),
      submitLabel: t("matches.hub.removeConfirm"),
      dismissLabel: t("common.cancel"),
      onSubmit: async (reason) => {
        if (!isHostRemovalReason(reason)) return;
        await removePlayerMutation.mutateAsync({
          userId: player.user_id,
          reason,
        });
      },
    });
  }

  const showWithdraw =
    hub?.viewer_status === "accepted" &&
    canParticipantWithdraw(hub.status, hub.viewer_is_creator);

  const showCancel =
    hub?.viewer_is_creator && canCreatorCancelMatch(hub.status);

  const showWithdrawRequest = hub?.viewer_status === "requested";

  /**
   * A full roster does not close the queue — somebody may still drop out, and
   * `join_match` has always accepted an ask on a full approval-gated match.
   * What it does close is the host's ability to answer one right now, so the
   * section says waitlist and Approve goes inert rather than throwing
   * `match_full` at whoever taps it.
   */
  const rosterFull = Boolean(hub && hub.participant_count >= hub.capacity);

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

  const rematchOpponents = useMemo(
    () => resolveRematchOpponents(hub?.participants, session?.user.id ?? ""),
    [hub?.participants, session?.user.id],
  );

  const showRematch = Boolean(
    hub &&
    canOfferRematch({
      matchStatus: hub.status,
      viewerStatus: hub.viewer_status,
      viewerAttendance: hub.viewer_attendance,
      opponentCount: rematchOpponents.length,
    }),
  );

  // Offered vs started, per surface: the audit's open question is not whether
  // rematch converts but which surface converts, and the hub is only one of three
  // planned. Recorded once per match rather than per render.
  useEffect(() => {
    if (showRematch) {
      trackRematch("offered", {
        surface: "hub",
        opponentCount: rematchOpponents.length,
      });
    }
  }, [showRematch, rematchOpponents.length]);

  function handleRematch(opponent: RematchOpponent) {
    if (!hub) return;
    trackRematch("started", { surface: "hub" });
    // Same route the Challenge button on a player profile takes, so the create
    // flow sees a normal invite-a-player draft and skips host-default hydration.
    beginRematch(hub, opponent);
    router.push(CREATE_MATCH_ROUTE);
  }

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
    const kind =
      primaryActionKind === "none" && canInvite ? "invite" : primaryActionKind;
    switch (kind) {
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
    const joinerIntent = joinerHubIntentCopyKey({
      viewerIsCreator: hub.viewer_is_creator,
      viewerStatus: hub.viewer_status,
      nextAction: hub.next_action,
    });
    const messages: string[] = [];
    if (
      shouldShowTimeAgreedBanner(hub.next_action, hub, booking, hasAgreedTime)
    ) {
      messages.push(t("matches.hub.timeAgreed"));
    }
    // Joiner intent already names awaiting club / court confirmed.
    if (hub.next_action === "awaiting_club" && !joinerIntent) {
      messages.push(t("matches.hub.awaitingClub"));
    }
    if (shouldShowPayAtClubBanner(hub.next_action, booking) && !joinerIntent) {
      messages.push(t("matches.hub.payAtClub"));
    }
    if (hub.is_stale_warning) {
      messages.push(t("matches.lifecycle.staleWarning"));
    }
    return messages.length > 0 ? messages.join("\n") : null;
  }, [booking, hasAgreedTime, hub, t]);

  const primaryBanner = useMemo<{
    body: string;
    tone: SemanticTone;
  } | null>(() => {
    if (!hub) return null;
    // First, and critical rather than actionable: the match is over, and the
    // hub is reachable now only through the cancellation notification. Nothing
    // else it could say comes before telling the player why they are here.
    if (hub.status === "cancelled") {
      return {
        body: hub.cancellation_reason
          ? t("matches.hub.cancelledBannerWithReason", {
              reason: hub.cancellation_reason,
            })
          : t("matches.hub.cancelledBanner"),
        tone: "critical",
      };
    }
    if (hub.status === "draft" && hub.viewer_is_creator) {
      return { body: t("matches.hub.draftBanner"), tone: "actionable" };
    }
    // Above the roster banners on purpose: for somebody still waiting on the
    // host, the match filling or agreeing a time is not their news, and none
    // of it is theirs to act on. `100` added the next_action; before it they
    // fell through to `view_match` and the state was carried only by the
    // presence of a cancel link.
    if (hub.next_action === "request_pending") {
      return { body: t("matches.hub.requestPendingBanner"), tone: "info" };
    }
    // Vs-hero already shows open slots; skip the duplicate awaiting banner.
    if (hub.next_action === "awaiting_players" && !vsHeroStage) {
      return {
        body: hasAcceptedBooking
          ? t("matches.hub.awaitingPlayersCourtSecured")
          : t("matches.hub.awaitingPlayers"),
        tone: "actionable",
      };
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
  const clubsBeforePeople = preferredClubsBeforePeoplePipeline({
    canConfirmCourt: showConfirmExternalCourt,
  });

  const chromePrimaryKind = resolveHubChromeAction({
    primaryAction: primaryActionKind,
    hasPreferredClubs,
  });
  const primaryActionLabelKey = hubPrimaryActionLabelKey(chromePrimaryKind);
  // Invite is sticky-footer only — never a filled control on the vs card.
  const actionsInReadyHero = Boolean(
    vsHeroStage && hub && hubChromeShowsInReadyHero(chromePrimaryKind),
  );
  const footerPrimaryKind = resolveHubFooterAction({
    chromeAction: chromePrimaryKind,
    actionsInReadyHero,
    canInvite,
  });

  const [pullRefreshing, setPullRefreshing] = useState(false);

  const hubLayoutProps = {
    title: hubTitle,
    statusSlot: hub ? (
      <SemanticBadge
        label={t(`matches.status.${hub.status}`)}
        tone={toneForMatchStatus(hub.status)}
      />
    ) : undefined,
    onBack: exitMatchHub,
    // Only user pull-to-refresh — background invalidate after confirm was
    // flashing RefreshControl and reading as a full-screen flicker.
    refreshing: pullRefreshing,
    onRefresh: () => {
      setPullRefreshing(true);
      void hubQuery.refetch().finally(() => setPullRefreshing(false));
    },
    dock:
      chatAvailable || chatLocked ? (
        <View style={styles.chatDock}>
          <MatchChatEntry
            matchId={id!}
            enabled={chatAvailable}
            locked={chatLocked}
            viewerUserId={session?.user.id}
            onPress={() => router.push(matchChatRoute(id!))}
          />
        </View>
      ) : null,
    footer:
      hub && (footerPrimaryKind !== "none" || showCancel) ? (
        <MatchHubActionBar
          actionKind={footerPrimaryKind}
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
        <ScreenError
          message={t("matches.hub.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void hubQuery.refetch()}
        />
      ) : null}

      {primaryBanner ? (
        <StatusBanner body={primaryBanner.body} tone={primaryBanner.tone} />
      ) : null}

      {secondaryBannerBody ? (
        <StatusBanner body={secondaryBannerBody} tone="info" />
      ) : null}

      {primaryActionKind === "request_join" ? (
        <View style={styles.joinNoteWrap}>
          <AppText style={[styles.joinNoteLabel, { writingDirection }]}>
            {t("matches.hub.joinNoteLabel")}
          </AppText>
          <TextInput
            accessibilityLabel={t("matches.hub.joinNoteLabel")}
            value={joinNote}
            onChangeText={(value) =>
              setJoinNote(value.slice(0, PLAYER_NOTE_MAX))
            }
            placeholder={t("matches.hub.joinNotePlaceholder")}
            placeholderTextColor={tennisColors.mutedForeground}
            style={[
              styles.joinNoteInput,
              {
                writingDirection,
                textAlign: writingDirection === "rtl" ? "right" : "left",
              },
            ]}
            multiline
            maxLength={PLAYER_NOTE_MAX}
          />
          <AppText style={[styles.joinNoteHint, { writingDirection }]}>
            {t("matches.hub.joinNoteHint")}
          </AppText>
        </View>
      ) : null}

      {vsHeroStage && hub ? (
        <MatchHubReadyHero
          hub={hub}
          participants={participants}
          viewerUserId={session?.user.id}
          startsAt={heroStartsAt}
          endsAt={heroEndsAt}
          slotOccupant={
            slotOccupant
              ? {
                  user_id: slotOccupant.user_id,
                  display_name: slotOccupant.display_name,
                  status: slotOccupant.status,
                  avatar_path: slotOccupant.avatar_path,
                }
              : null
          }
          onReschedule={
            showReschedule
              ? () => router.push(`/match/${id}/reschedule`)
              : undefined
          }
          primaryLabel={
            chromePrimaryKind !== "invite" && primaryActionLabelKey
              ? t(primaryActionLabelKey)
              : undefined
          }
          primaryLoading={
            chromePrimaryKind === "join" || chromePrimaryKind === "request_join"
              ? joinMutation.isPending
              : false
          }
          onPrimary={
            chromePrimaryKind !== "none" && chromePrimaryKind !== "invite"
              ? handlePrimaryAction
              : undefined
          }
          onRemovePlayer={
            hub.viewer_is_creator ? handleRemovePlayer : undefined
          }
        />
      ) : null}

      {joinerIntentKey ? (
        <StatusBanner body={t(joinerIntentKey)} tone="info" />
      ) : null}

      {clubsBeforePeople && vsHeroStage && hasPreferredClubs ? (
        <MatchHubPreferredClubs
          clubs={hub!.preferred_clubs}
          matchId={id!}
          isHost={hub!.viewer_is_creator}
          canConfirmCourt={showConfirmExternalCourt}
          compact={compactPreferredClubs}
          agreedSlot={agreedSlot ?? null}
          booking={courtLocked ? booking : null}
          releasing={releaseCourtMutation.isPending}
          onRelease={showReleaseCourt ? handleReleaseCourt : undefined}
        />
      ) : null}

      {hub?.viewer_is_creator && pendingRequests.length > 0 ? (
        <MatchHubJoinRequestCarousel
          requests={pendingRequests}
          rosterFull={rosterFull}
          pendingUserId={
            respondMutation.isPending ? respondMutation.variables?.userId : null
          }
          pendingAccept={
            respondMutation.isPending ? respondMutation.variables?.accept : null
          }
          onApprove={(userId) =>
            respondMutation.mutate({ userId, accept: true })
          }
          onDecline={(userId) =>
            respondMutation.mutate({ userId, accept: false })
          }
        />
      ) : null}

      {hub?.viewer_is_creator && invitedPlayers.length > 0 ? (
        <MatchHubInvitedList
          invited={invitedPlayers}
          withdrawing={cancelInviteMutation.isPending}
          onWithdraw={(userId) => cancelInviteMutation.mutate(userId)}
        />
      ) : null}

      {!clubsBeforePeople && vsHeroStage && hasPreferredClubs ? (
        <MatchHubPreferredClubs
          clubs={hub!.preferred_clubs}
          matchId={id!}
          isHost={hub!.viewer_is_creator}
          canConfirmCourt={showConfirmExternalCourt}
          compact={compactPreferredClubs}
          agreedSlot={agreedSlot ?? null}
          booking={courtLocked ? booking : null}
          releasing={releaseCourtMutation.isPending}
          onRelease={showReleaseCourt ? handleReleaseCourt : undefined}
        />
      ) : !clubsBeforePeople && courtLocked && booking ? (
        <MatchHubConfirmedHero
          booking={booking}
          matchId={id!}
          releasing={releaseCourtMutation.isPending}
          onRelease={showReleaseCourt ? handleReleaseCourt : undefined}
        />
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

      {showVoteUi &&
      !isFixedTimingMode(hub?.timing_mode) &&
      proposedTimes.length > 0 ? (
        <PlayerProfileSection title={t("matches.hub.proposedTimes")}>
          <AppText style={styles.timeMeta}>
            {t("matches.hub.votePrompt")}
          </AppText>
          {showManageTimes && proposedTimes.length < 3 ? (
            <FigmaSecondaryButton
              label={t("matches.hub.addAnotherTime")}
              onPress={() => router.push(`/match/${id}/add-time`)}
            />
          ) : null}
          {proposedTimes.map((slot) => renderTimeSlot(slot))}
        </PlayerProfileSection>
      ) : null}

      {hub && session?.user.id ? (
        <MatchResultPanel
          matchId={id!}
          hub={hub}
          viewerUserId={session.user.id}
        />
      ) : null}

      {showRematch ? (
        <MatchRematchCard
          opponents={rematchOpponents}
          onRematch={handleRematch}
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

      <MatchHubMoreSection>
        <MatchPushNudge
          userId={session?.user.id}
          viewerIsParticipant={hub?.viewer_status === "accepted"}
        />

        {hub?.can_extend_listing ? (
          <FigmaSecondaryButton
            label={t("matches.lifecycle.extendListing")}
            disabled={extendMutation.isPending}
            onPress={() => extendMutation.mutate()}
          />
        ) : null}

        {hub?.notes && polishedLayout ? (
          <AppText style={[styles.hubNotes, { writingDirection }]}>
            {hub.notes}
          </AppText>
        ) : null}

        {booking && !courtLocked && !polishedLayout ? (
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

        {hub && shouldShowDiscoveryOverview(hub, booking, hasAgreedTime) ? (
          <MatchHubOverviewDetails hub={hub} />
        ) : null}

        {participants.length > 0 && !vsHeroStage ? (
          <MatchHubParticipants
            participants={participants}
            viewerUserId={session?.user.id}
          />
        ) : null}

        {canInvite &&
        footerPrimaryKind !== "invite" &&
        !actionsInReadyHero &&
        pendingRequests.length === 0 ? (
          <FigmaSecondaryButton
            label={t("matches.invite.invitePlayers")}
            onPress={() => router.push(matchInviteRoute(String(id)))}
          />
        ) : null}

        {!showVoteUi &&
        !isFixedTimingMode(hub?.timing_mode) &&
        proposedTimes.length > 0 ? (
          <PlayerProfileSection title={t("matches.hub.proposedTimes")}>
            {showManageTimes && proposedTimes.length < 3 ? (
              <FigmaSecondaryButton
                label={t("matches.hub.addAnotherTime")}
                onPress={() => router.push(`/match/${id}/add-time`)}
              />
            ) : null}
            {proposedTimes.map((slot) => renderTimeSlot(slot))}
          </PlayerProfileSection>
        ) : null}

        {hub &&
        shouldShowAgreedTimeSection(Boolean(agreedSlot), hub, booking) ? (
          <PlayerProfileSection title={t("matches.hub.agreedTime")}>
            <AppText style={styles.timeLabel}>
              {formatUtcSlotInBeirut(
                agreedSlot!.starts_at,
                agreedSlot!.ends_at,
              )}
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

        {showWithdraw ? (
          <HubDestructiveLink
            label={t("matches.hub.withdraw")}
            onPress={() => router.push(matchWithdrawRoute(id!))}
          />
        ) : null}

        {showWithdrawRequest ? (
          <HubDestructiveLink
            label={t("matches.hub.withdrawRequest")}
            onPress={() =>
              confirmAction({
                title: t("matches.hub.withdrawRequest"),
                message: t("matches.hub.withdrawRequestConfirm"),
                confirmLabel: t("matches.hub.withdrawRequest"),
                cancelLabel: t("common.cancel"),
                onConfirm: () => withdrawRequestMutation.mutate(),
              })
            }
          />
        ) : null}
      </MatchHubMoreSection>
    </MatchHubLayout>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    chatDock: {
      borderTopWidth: 1,
      borderTopColor: tennisColors.border,
      backgroundColor: tennisColors.background,
      paddingHorizontal: tennisSpacing.screenX,
      paddingTop: 12,
      paddingBottom: 8,
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
    joinNoteWrap: {
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    joinNoteLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: typography.size.sm,
      color: tennisColors.primaryDark,
    },
    joinNoteInput: {
      minHeight: 64,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.md,
      fontFamily: tennisFontFamily.body,
      fontSize: typography.size.sm,
      color: tennisColors.primaryDark,
      textAlignVertical: "top",
    },
    joinNoteHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: typography.size.xs,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
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
  }),
);
