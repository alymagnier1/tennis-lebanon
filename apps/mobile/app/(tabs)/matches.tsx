import { useState } from "react";

import { Alert, View } from "react-native";

import { router } from "expo-router";

import { useTranslation } from "react-i18next";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptMatchInvitation,
  declineMatchInvitation,
  extendMatchListing,
  listMyMatchInvites,
  listMyMatches,
  listMyCompletedMatches,
} from "@tennis-lebanon/api";

import { formatMatchScore } from "@tennis-lebanon/domain";

import {
  EmptyState,
  ListSkeleton,
  MatchCard,
  SegmentTabs,
  appStyles,
} from "../../src/components/AppUi";
import { TabPageHeader } from "../../src/components/TabPageHeader";

import {
  PrimaryButton,
  Screen,
  ScreenError,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";

import { formatUtcInBeirut } from "../../src/lib/beirut-time";
import {
  buildMatchCardHeadline,
  matchCardOpponentLabel,
  resolveMatchCardOpponent,
} from "../../src/lib/match-card-headline";
import { opponentAvatarColor } from "../../src/lib/match-card-status";

import { supabase } from "../../src/lib/supabase";

import { startNewMatchCreate } from "../../src/lib/create-match-guard";
import { useAuth } from "../../src/providers/AuthProvider";

type MatchesSegment = "invites" | "active" | "completed";

export default function MatchesScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const viewerName = profile?.display_name ?? "";

  const queryClient = useQueryClient();

  const [segment, setSegment] = useState<MatchesSegment>("invites");

  const invitesQuery = useQuery({
    queryKey: ["my-match-invites"],

    queryFn: () => listMyMatchInvites(supabase),
  });

  const matchesQuery = useQuery({
    queryKey: ["my-matches"],

    queryFn: () => listMyMatches(supabase),
  });

  const completedQuery = useQuery({
    queryKey: ["my-completed-matches"],

    queryFn: () => listMyCompletedMatches(supabase),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["my-match-invites"] });

    await queryClient.invalidateQueries({ queryKey: ["my-matches"] });

    await queryClient.invalidateQueries({ queryKey: ["my-completed-matches"] });

    await queryClient.invalidateQueries({ queryKey: ["match-hub"] });

    await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });
  };

  const acceptMutation = useMutation({
    mutationFn: (invitationId: string) =>
      acceptMatchInvitation(supabase, invitationId),

    onSuccess: async (matchId) => {
      await invalidate();

      router.push({
        pathname: "/match/[id]",

        params: { id: matchId },
      });
    },

    onError: () => Alert.alert(t("matches.invite.acceptError")),
  });

  const declineMutation = useMutation({
    mutationFn: (invitationId: string) =>
      declineMatchInvitation(supabase, invitationId),

    onSuccess: invalidate,

    onError: () => Alert.alert(t("matches.invite.declineError")),
  });

  const extendMutation = useMutation({
    mutationFn: (matchId: string) => extendMatchListing(supabase, matchId),

    onSuccess: invalidate,

    onError: () => Alert.alert(t("matches.lifecycle.extendError")),
  });

  const refreshing =
    invitesQuery.isRefetching ||
    matchesQuery.isRefetching ||
    completedQuery.isRefetching;

  const onRefresh = async () => {
    await Promise.all([
      invitesQuery.refetch(),

      matchesQuery.refetch(),

      completedQuery.refetch(),
    ]);
  };

  const showEmptyInvites =
    segment === "invites" &&
    invitesQuery.data?.length === 0 &&
    !invitesQuery.isLoading;

  const showEmptyActive =
    segment === "active" &&
    matchesQuery.data?.length === 0 &&
    !matchesQuery.isLoading;

  const showEmptyCompleted =
    segment === "completed" &&
    completedQuery.data?.length === 0 &&
    !completedQuery.isLoading;

  const segmentLoading =
    (segment === "invites" && invitesQuery.isLoading) ||
    (segment === "active" && matchesQuery.isLoading) ||
    (segment === "completed" && completedQuery.isLoading);

  const segmentError =
    (segment === "invites" && invitesQuery.isError) ||
    (segment === "active" && matchesQuery.isError) ||
    (segment === "completed" && completedQuery.isError);

  const retrySegment = () => {
    if (segment === "invites") void invitesQuery.refetch();
    if (segment === "active") void matchesQuery.refetch();
    if (segment === "completed") void completedQuery.refetch();
  };

  return (
    <Screen
      title={t("matches.list.title")}
      showTitle={false}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      fixedHeader={
        <>
          <TabPageHeader
            title={t("matches.list.title")}
            description={t("matches.list.description")}
          />
          <SegmentTabs
            value={segment}
            options={[
              { value: "invites", label: t("matches.invite.inboxTab") },
              { value: "active", label: t("matches.list.activeTab") },
              { value: "completed", label: t("matches.list.completedTab") },
            ]}
            onChange={setSegment}
          />
        </>
      }
    >
      {segmentLoading ? <ListSkeleton rows={4} /> : null}

      {segmentError ? (
        <ScreenError
          message={
            segment === "invites"
              ? t("matches.invite.inboxLoadError")
              : t("matches.list.loadError")
          }
          retryLabel={t("common.retry")}
          onRetry={retrySegment}
        />
      ) : null}

      {segment === "invites" ? (
        <>
          {showEmptyInvites ? (
            <EmptyState
              title={t("matches.invite.inboxEmptyTitle")}

              body={t("matches.invite.inboxEmpty")}

              action={
                <PrimaryButton
                  label={t("matches.create.organiseCta")}

                  onPress={() => startNewMatchCreate()}
                />
              }
            />
          ) : null}

          <View style={appStyles.cardList}>
            {!segmentLoading && !segmentError
              ? invitesQuery.data?.map((invite) => (
                  <View key={invite.invitation_id} style={formStyles.stack}>
                    <MatchCard
                      status={invite.match_status}
                      statusLabel={t(`matches.status.${invite.match_status}`)}
                      dateTimeLabel={
                        invite.soonest_time
                          ? formatUtcInBeirut(invite.soonest_time)
                          : undefined
                      }
                      headline={buildMatchCardHeadline(t, {
                        opponentNames: invite.inviter_display_name,
                        status: invite.match_status,
                        participantCount: invite.participant_count,
                        capacity: invite.capacity,
                      })}
                      viewerName={viewerName}
                      viewerAvatarPath={profile?.avatar_path}
                      opponentName={invite.inviter_display_name}
                      opponentAvatarColor={opponentAvatarColor(
                        invite.inviter_display_name,
                      )}
                      formatChip={t(`formats.${invite.format}`)}
                      locationChip={`${invite.participant_count}/${invite.capacity}`}
                    />

                    <PrimaryButton
                      label={t("matches.invite.accept")}

                      loading={acceptMutation.isPending}

                      onPress={() =>
                        acceptMutation.mutate(invite.invitation_id)
                      }
                    />

                    <SecondaryButton
                      label={t("matches.invite.decline")}

                      disabled={declineMutation.isPending}

                      onPress={() =>
                        declineMutation.mutate(invite.invitation_id)
                      }
                    />
                  </View>
                ))
              : null}
          </View>
        </>
      ) : segment === "active" ? (
        <>
          {showEmptyActive ? (
            <EmptyState
              title={t("matches.list.emptyTitle")}

              body={t("matches.list.empty")}

              action={
                <PrimaryButton
                  label={t("matches.create.organiseCta")}

                  onPress={() => startNewMatchCreate()}
                />
              }
            />
          ) : null}

          <View style={appStyles.cardList}>
            {!segmentLoading && !segmentError
              ? matchesQuery.data?.map((match) => {
                  const headlineInput = {
                    opponentNames: match.opponent_names,
                    status: match.status,
                    participantCount: match.participant_count,
                    capacity: match.capacity,
                  };
                  const opponent = resolveMatchCardOpponent(t, headlineInput);
                  const locationChip =
                    match.club_name ??
                    (match.has_court
                      ? t("matches.list.courtSecuredBadge")
                      : undefined);

                  return (
                  <View key={match.match_id} style={formStyles.stack}>
                    <MatchCard
                      accentBorder
                      status={match.status}
                      statusLabel={t(`matches.status.${match.status}`)}
                      dateTimeLabel={
                        match.soonest_time
                          ? formatUtcInBeirut(match.soonest_time)
                          : undefined
                      }
                      headline={buildMatchCardHeadline(t, headlineInput)}
                      viewerName={viewerName}
                      viewerAvatarPath={profile?.avatar_path}
                      opponentName={opponent}
                      opponentAvatarColor={
                        opponent ? opponentAvatarColor(opponent) : undefined
                      }
                      formatChip={t(`formats.${match.format}`)}
                      locationChip={locationChip}
                      badges={
                        match.is_stale_warning
                          ? [
                              {
                                label: t("matches.lifecycle.staleBadge"),
                                tone: "attention" as const,
                              },
                            ]
                          : undefined
                      }
                      note={match.notes ?? undefined}
                      onPress={() =>
                        router.push({
                          pathname: "/match/[id]",

                          params: { id: match.match_id },
                        })
                      }
                    />

                    {match.can_extend_listing ? (
                      <SecondaryButton
                        label={t("matches.lifecycle.extendListing")}

                        loading={extendMutation.isPending}

                        onPress={() => extendMutation.mutate(match.match_id)}
                      />
                    ) : null}
                  </View>
                  );
                })
              : null}
          </View>
        </>
      ) : (
        <>
          {showEmptyCompleted ? (
            <EmptyState
              title={t("matches.list.completedEmptyTitle")}

              body={t("matches.list.completedEmpty")}
            />
          ) : null}

          <View style={appStyles.cardList}>
            {!segmentLoading && !segmentError
              ? completedQuery.data?.map((match) => {
                  const scoreLabel = formatMatchScore(match.score);

                  const outcomeLabel = match.viewer_won
                    ? t("matches.list.won")
                    : t("matches.list.lost");

                  const opponentLabel = match.opponent_names
                    ? t("matches.list.vsOpponent", {
                        name: match.opponent_names,
                      })
                    : undefined;

                  const playedLabel = match.played_at
                    ? formatUtcInBeirut(match.played_at)
                    : formatUtcInBeirut(match.completed_at);

                  const opponent = matchCardOpponentLabel(match.opponent_names);
                  const headlineInput = {
                    opponentNames: match.opponent_names,
                    status: "completed",
                    participantCount: opponent ? 2 : 1,
                    capacity: 2,
                  };
                  const resolvedOpponent = resolveMatchCardOpponent(
                    t,
                    headlineInput,
                  );

                  return (
                    <MatchCard
                      key={match.match_id}
                      accentBorder
                      status="completed"
                      statusLabel={outcomeLabel}
                      dateTimeLabel={playedLabel}
                      headline={
                        resolvedOpponent
                          ? buildMatchCardHeadline(t, headlineInput)
                          : opponentLabel ??
                            t(`matches.results.status.${match.result_status}`)
                      }
                      viewerName={viewerName}
                      viewerAvatarPath={profile?.avatar_path}
                      opponentName={resolvedOpponent}
                      opponentAvatarColor={
                        resolvedOpponent
                          ? opponentAvatarColor(resolvedOpponent)
                          : undefined
                      }
                      formatChip={t(`formats.${match.format}`)}
                      locationChip={match.club_name ?? undefined}
                      scoreBanner={
                        scoreLabel
                          ? {
                              won: match.viewer_won,
                              score: scoreLabel,
                              title: match.viewer_won
                                ? t("matches.list.won")
                                : t("matches.list.lost"),
                            }
                          : undefined
                      }
                      onPress={() =>
                        router.push({
                          pathname: "/match/[id]",

                          params: { id: match.match_id },
                        })
                      }
                    />
                  );
                })
              : null}
          </View>
        </>
      )}
    </Screen>
  );
}
