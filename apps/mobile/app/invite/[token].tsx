import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptMatchInvite,
  declineMatchInvitation,
  previewMatchInvite,
  type MatchInvitePreviewStatus,
} from "@tennis-lebanon/api";
import { MatchCard } from "../../src/components/AppUi";
import { AppText } from "../../src/components/AppText";
import {
  PrimaryButton,
  Screen,
  ScreenError,
  SecondaryButton,
} from "../../src/components/FormUi";
import { formatCompactUtcInBeirut } from "../../src/lib/beirut-time";
import { authRouteForState } from "../../src/lib/auth-routing";
import { buildMatchCardHeadline } from "../../src/lib/match-card-headline";
import { matchCardAreaLabel } from "../../src/lib/match-clubs";
import { opponentAvatarColor } from "../../src/lib/match-card-status";
import {
  clearPendingInvite,
  rememberPendingInvite,
} from "../../src/lib/pending-invite";
import { discoverOpenMatchesRoute, matchHubRoute } from "../../src/lib/routes";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

/** Which reason copy a non-joinable invite deserves. */
const STATUS_COPY_KEY: Record<
  Exclude<MatchInvitePreviewStatus, "ok">,
  string
> = {
  not_found: "matches.invite.link.notFound",
  wrong_recipient: "matches.invite.link.wrongRecipient",
  revoked: "matches.invite.link.revoked",
  already_accepted: "matches.invite.link.alreadyAccepted",
  already_member: "matches.invite.link.alreadyMember",
  expired: "matches.invite.link.expired",
  full: "matches.invite.link.full",
  unavailable: "matches.invite.link.unavailable",
};

/**
 * Opening an invite link must not join you to anything.
 *
 * This screen used to call `accept_match_invite` from an effect the moment auth
 * resolved, which meant the tap that opened the link was the tap that accepted
 * it. A shared link is made with a null recipient precisely so a host can send
 * it to somebody who is not on RacketBound at all, so that auto-accept landed
 * on brand-new accounts seconds after sign-up.
 *
 * It now reads the invitation with `preview_match_invite` — which does not
 * mutate — and accepts only when the person says so. Decline is a real refusal
 * rather than a way out of the screen: `decline_match_invitation` stamps
 * `declined_at` for an addressed invitation, and matches nothing for a shared
 * link, which has no recipient to refuse on anyone's behalf.
 */
export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { state } = useAuth();
  const queryClient = useQueryClient();

  // Somebody who is not signed in yet cannot act on this, and the route is gone
  // by the time sign-up and onboarding finish. Remember the token so the tab
  // layout can bring them back here; forget it once they are.
  useEffect(() => {
    if (!token || state === "loading") return;
    if (state === "ready") {
      void clearPendingInvite();
    } else {
      void rememberPendingInvite(token);
    }
  }, [state, token]);

  const previewQuery = useQuery({
    queryKey: ["match-invite-preview", token],
    queryFn: () => previewMatchInvite(supabase, token!),
    enabled: state === "ready" && Boolean(token),
    // A consumed or withdrawn invitation does not come back, and a stale cache
    // would let a second open look joinable.
    staleTime: 0,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptMatchInvite(supabase, token!),
    onSuccess: async (matchId) => {
      await queryClient.invalidateQueries({ queryKey: ["my-match-invites"] });
      router.replace(matchHubRoute(matchId));
    },
  });

  const declineMutation = useMutation({
    mutationFn: (invitationId: string) =>
      declineMatchInvitation(supabase, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-match-invites"] });
      router.replace(discoverOpenMatchesRoute());
    },
  });

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </View>
    );
  }

  if (state !== "ready") {
    const destination = authRouteForState(state);
    // Most people here have never had an account: a shared link is how they
    // heard of RacketBound. "Try again" read as if they had failed at something.
    const actionLabel =
      state === "anonymous"
        ? t("matches.invite.signInAction")
        : state === "needsOnboarding"
          ? t("auth.continueOnboarding")
          : t("auth.tryAgain");
    return (
      <Screen
        title={t("matches.invite.title")}
        description={t("matches.invite.signInRequired")}
      >
        {destination ? (
          <PrimaryButton
            label={actionLabel}
            onPress={() => router.replace(destination)}
          />
        ) : null}
      </Screen>
    );
  }

  if (previewQuery.isPending) {
    return (
      <Screen title={t("matches.invite.title")}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </Screen>
    );
  }

  if (previewQuery.isError) {
    return (
      <Screen title={t("matches.invite.title")}>
        <ScreenError
          message={t("matches.invite.link.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void previewQuery.refetch()}
        />
      </Screen>
    );
  }

  const preview = previewQuery.data;

  // Every refusal names itself. All of these were one `P0002` before `105`, so
  // the screen could only ever say "not found or expired" — true of the
  // invitation, and useless to the person holding it.
  if (preview.status !== "ok") {
    const isMember = preview.status === "already_member";
    return (
      <Screen
        title={t("matches.invite.title")}
        description={t(STATUS_COPY_KEY[preview.status])}
      >
        {isMember && preview.match_id ? (
          <PrimaryButton
            label={t("matches.invite.goToMatch")}
            onPress={() => router.replace(matchHubRoute(preview.match_id!))}
          />
        ) : (
          <SecondaryButton
            label={t("matches.invite.link.browse")}
            onPress={() => router.replace(discoverOpenMatchesRoute())}
          />
        )}
      </Screen>
    );
  }

  // `ok` means the server resolved a joinable match, so these are set. The
  // composite type still allows null on every field — it has to, because the
  // refusals above return status alone — so this narrows rather than asserts.
  // A reason is better than a card with blanks in it.
  const { match_status: matchStatus, participant_count: joined } = preview;
  const capacity = preview.capacity;
  if (!matchStatus || joined == null || capacity == null) {
    return (
      <Screen title={t("matches.invite.title")}>
        <ScreenError
          message={t("matches.invite.link.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void previewQuery.refetch()}
        />
      </Screen>
    );
  }

  const areaLabel = matchCardAreaLabel(preview.zones, locale, {
    compact: true,
  });

  return (
    <Screen title={t("matches.invite.title")}>
      <MatchCard
        status={matchStatus}
        statusLabel={t(`matches.status.${matchStatus}`)}
        dateTimeLabel={
          preview.soonest_time
            ? formatCompactUtcInBeirut(preview.soonest_time)
            : undefined
        }
        headline={buildMatchCardHeadline(t, {
          opponentNames: preview.inviter_display_name,
          status: matchStatus,
          participantCount: joined,
          capacity,
        })}
        opponentName={preview.inviter_display_name ?? undefined}
        opponentAvatarColor={opponentAvatarColor(
          preview.inviter_display_name ?? "",
        )}
        formatChip={preview.format ? t(`formats.${preview.format}`) : undefined}
        locationChip={`${joined}/${capacity}`}
        areaChip={areaLabel}
      />

      {preview.note ? (
        <AppText>
          {t("matches.invite.noteQuote", { note: preview.note })}
        </AppText>
      ) : null}

      {/* No retry link: the Accept and Decline buttons below are the retry. */}
      {acceptMutation.isError ? (
        <ScreenError
          message={t("matches.invite.acceptError")}
          retryLabel={t("common.retry")}
        />
      ) : null}

      {declineMutation.isError ? (
        <ScreenError
          message={t("matches.invite.declineError")}
          retryLabel={t("common.retry")}
        />
      ) : null}

      <PrimaryButton
        label={t("matches.invite.accept")}
        loading={acceptMutation.isPending}
        disabled={declineMutation.isPending}
        onPress={() => acceptMutation.mutate()}
      />

      <SecondaryButton
        label={t("matches.invite.decline")}
        disabled={acceptMutation.isPending || declineMutation.isPending}
        onPress={() => {
          if (!preview.invitation_id) {
            router.replace(discoverOpenMatchesRoute());
            return;
          }
          declineMutation.mutate(preview.invitation_id);
        }}
      />
    </Screen>
  );
}
