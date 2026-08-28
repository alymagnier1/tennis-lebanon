import { useEffect, useMemo, useState } from "react";
import { notify } from "../../src/lib/confirm-action";

import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabRootHeaderPaddingTop } from "../../src/lib/tab-root-header";

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
  type MyMatchRow,
} from "@tennis-lebanon/api";

import {
  canCreatorCancelBeforeBooking,
  formatMatchScore,
} from "@tennis-lebanon/domain";

import {
  EmptyState,
  ListSkeleton,
  MatchCard,
  SegmentTabs,
  appStyles,
} from "../../src/components/AppUi";
import { AppText } from "../../src/components/AppText";

import {
  PrimaryButton,
  Screen,
  ScreenError,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";

import {
  formatCompactUtcInBeirut,
  formatUtcInBeirut,
} from "../../src/lib/beirut-time";
import {
  buildMatchCardHeadline,
  matchCardOpponentLabel,
  resolveMatchCardOpponent,
} from "../../src/lib/match-card-headline";
import { buildMatchCardBadges } from "../../src/lib/match-card-badges";
import { confirmCancelHostedMatch } from "../../src/lib/confirm-cancel-hosted-match";
import {
  matchCardAreaLabel,
  matchCardClubLabel,
} from "../../src/lib/match-clubs";
import { opponentAvatarColor } from "../../src/lib/match-card-status";
import {
  ACTIVE_MATCH_GROUPS,
  activeMatchGroupEmptyBodyKey,
  activeMatchGroupEmptyTitleKey,
  activeMatchGroupTabKey,
  defaultActiveMatchGroup,
  groupActiveMatches,
  matchListAction,
  matchListActionOpensInvite,
  matchListOpensResultSheet,
  matchListStartsAt,
  matchTabBadgeCounts,
  completedMatchNeedsScore,
  type ActiveMatchGroup,
} from "../../src/lib/match-list-card";
import {
  DEFAULT_COMPLETED_TIME_FILTER,
  completedTimeFilterEmptyBodyKey,
  completedTimeFilterEmptyTitleKey,
  filterCompletedMatchesByTime,
  type CompletedTimeFilter,
} from "../../src/lib/completed-match-time-filter";
import { CompletedTimeFilterControl } from "../../src/components/match/CompletedTimeFilterControl";

import { supabase } from "../../src/lib/supabase";
import { trackRematch } from "../../src/lib/analytics";
import { beginRematch } from "../../src/lib/rematch-draft";
import { resolveRematchTarget } from "../../src/lib/start-rematch";
import {
  CREATE_MATCH_ROUTE,
  matchHubRoute,
  matchInviteRoute,
} from "../../src/lib/routes";

import { startNewMatchCreate } from "../../src/lib/create-match-guard";
import { MatchResultSheet } from "../../src/components/MatchResultSheet";
import { useAuth } from "../../src/providers/AuthProvider";

type MatchesSegment = "invites" | "active" | "completed";

export default function MatchesScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const viewerName = profile?.display_name ?? "";
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const queryClient = useQueryClient();

  const [segment, setSegment] = useState<MatchesSegment>("invites");
  const [activeGroup, setActiveGroup] = useState<ActiveMatchGroup>("upcoming");
  const [completedTimeFilter, setCompletedTimeFilter] =
    useState<CompletedTimeFilter>(DEFAULT_COMPLETED_TIME_FILTER);
  const [resultMatchId, setResultMatchId] = useState<string | null>(null);

  /**
   * A CompletedMatchRow has no opponent ids and none of the match shape a draft
   * needs, so the hub is fetched on tap. Doubles is sent to the hub, where the
   * card renders one button per opponent, rather than guessing which of three
   * "again" means.
   */
  const [rematchPending, setRematchPending] = useState(false);
  const startRematch = async (matchId: string) => {
    const viewerUserId = session?.user.id;
    if (!viewerUserId || rematchPending) {
      return;
    }

    setRematchPending(true);
    try {
      const { outcome, hub } = await resolveRematchTarget({
        client: supabase,
        matchId,
        viewerUserId,
      });

      if (outcome.kind !== "ready") {
        router.push(matchHubRoute(matchId));
        return;
      }

      trackRematch("started", { surface: "completed_list" });
      beginRematch(
        hub,
        { userId: outcome.opponentUserId, displayName: outcome.opponentName },
        "completed_list",
      );
      router.push(CREATE_MATCH_ROUTE);
    } catch {
      router.push(matchHubRoute(matchId));
    } finally {
      setRematchPending(false);
    }
  };

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

    onError: () => notify(t("matches.invite.acceptError")),
  });

  const declineMutation = useMutation({
    mutationFn: (invitationId: string) =>
      declineMatchInvitation(supabase, invitationId),

    onSuccess: invalidate,

    onError: () => notify(t("matches.invite.declineError")),
  });

  const extendMutation = useMutation({
    mutationFn: (matchId: string) => extendMatchListing(supabase, matchId),

    onSuccess: invalidate,

    onError: () => notify(t("matches.lifecycle.extendError")),
  });

  const groupedActive = useMemo(
    () => groupActiveMatches(matchesQuery.data ?? []),
    [matchesQuery.data],
  );

  const badgeCounts = useMemo(
    () =>
      matchTabBadgeCounts({
        inviteCount: invitesQuery.data?.length ?? 0,
        matches: matchesQuery.data ?? [],
      }),
    [invitesQuery.data, matchesQuery.data],
  );

  /*
   * Derived during render rather than corrected afterwards in an effect.
   *
   * The selected group can empty out underneath the player -- a match moves on,
   * or a refetch lands -- and the tab should fall back to one with something in
   * it. Doing that with `setActiveGroup` inside an effect meant rendering the
   * empty group once, then re-rendering, which is the cascading-render the
   * React Compiler lint rejects. `activeGroup` still records what the player
   * chose; this is only what that choice resolves to right now.
   */
  const effectiveActiveGroup: ActiveMatchGroup =
    groupedActive[activeGroup].length > 0
      ? activeGroup
      : defaultActiveMatchGroup(groupedActive);

  const activeGroupMatches = groupedActive[effectiveActiveGroup];

  const filteredCompletedMatches = useMemo(
    () =>
      filterCompletedMatchesByTime(
        completedQuery.data ?? [],
        completedTimeFilter,
      ),
    [completedQuery.data, completedTimeFilter],
  );

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

  // Every empty below is guarded on the query having succeeded. A failed list
  // resolves to `data ?? []`, so without the guard "nothing here yet" renders
  // on top of the error and reads as a verdict on the pilot rather than a fetch
  // that failed.
  const showEmptyInvites =
    segment === "invites" &&
    invitesQuery.data?.length === 0 &&
    !invitesQuery.isLoading &&
    !invitesQuery.isError;

  const showEmptyActive =
    segment === "active" &&
    !matchesQuery.isLoading &&
    !matchesQuery.isError &&
    groupedActive.now.length === 0 &&
    groupedActive.upcoming.length === 0;

  const showEmptyActiveGroup =
    segment === "active" &&
    !showEmptyActive &&
    !matchesQuery.isLoading &&
    !matchesQuery.isError &&
    activeGroupMatches.length === 0;

  const showEmptyCompleted =
    segment === "completed" &&
    filteredCompletedMatches.length === 0 &&
    !completedQuery.isLoading &&
    !completedQuery.isError;

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

  function renderActiveMatch(match: MyMatchRow) {
    const headlineInput = {
      opponentNames: match.opponent_names,
      status: match.status,
      participantCount: match.participant_count,
      capacity: match.capacity,
    };
    const opponent = resolveMatchCardOpponent(t, headlineInput);
    const locationChip = matchCardClubLabel({
      clubName: match.club_name,
      preferredClubs: match.preferred_clubs,
      hasCourt: match.has_court,
      courtSecuredFallback: t("matches.list.courtSecuredBadge"),
      compact: true,
    });
    const areaChip = matchCardAreaLabel(match.zones, locale, {
      compact: true,
    });
    const action = matchListAction({
      status: match.status,
      isCreator: match.is_creator,
      viewerAttendance: match.viewer_attendance,
      participantStatus: match.participant_status,
    });
    const opensInvite = matchListActionOpensInvite({
      status: match.status,
      isCreator: match.is_creator,
    });

    // Only your own, and only while calling it off is still your call. Three
    // matches is the cap, so the thing that frees a slot should not be four
    // taps and a scroll away inside the match itself.
    const canDismiss =
      match.is_creator && canCreatorCancelBeforeBooking(match.status);

    return (
      <View key={match.match_id} style={formStyles.stack}>
        <MatchCard
          accentBorder
          status={match.status}
          statusLabel={t(`matches.status.${match.status}`)}
          actionLabel={action ? t(action.labelKey) : undefined}
          actionTone={action?.tone}
          dateTimeLabel={(() => {
            const startsAt = matchListStartsAt(match);
            return startsAt ? formatCompactUtcInBeirut(startsAt) : undefined;
          })()}
          headline={buildMatchCardHeadline(t, headlineInput)}
          viewerName={viewerName}
          viewerAvatarPath={profile?.avatar_path}
          opponentName={opponent}
          opponentAvatarColor={
            opponent ? opponentAvatarColor(opponent) : undefined
          }
          formatChip={t(`formats.${match.format}`)}
          locationChip={locationChip}
          areaChip={areaChip}
          badges={buildMatchCardBadges(t, match)}
          note={match.notes ?? undefined}
          dismissLabel={t("matches.hub.cancel")}
          onDismiss={
            canDismiss
              ? () =>
                  confirmCancelHostedMatch(
                    {
                      matchId: match.match_id,
                      status: match.status,
                      participantCount: match.participant_count,
                      bookingStartsAt: match.court_starts_at,
                    },
                    t,
                    () => void matchesQuery.refetch(),
                  )
              : undefined
          }
          onPress={() =>
            router.push({
              pathname: "/match/[id]",
              params: { id: match.match_id },
            })
          }
          onActionPress={
            matchListOpensResultSheet(match)
              ? () => setResultMatchId(match.match_id)
              : opensInvite
                ? () => router.push(matchInviteRoute(match.match_id))
                : undefined
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
  }

  return (
    <Screen
      title={t("matches.list.title")}
      showTitle={false}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      fixedHeader={
        <View
          style={{
            paddingTop: tabRootHeaderPaddingTop(insets.top),
            gap: 16,
          }}
        >
          <SegmentTabs
            value={segment}
            options={[
              {
                value: "invites",
                label: t("matches.invite.inboxTab"),
                badgeCount: badgeCounts.invites,
              },
              {
                value: "active",
                label: t("matches.list.activeTab"),
                badgeCount: badgeCounts.active,
              },
              { value: "completed", label: t("matches.list.completedTab") },
            ]}
            onChange={setSegment}
          />
          {segment === "active" ? (
            <SegmentTabs
              variant="nested"
              value={effectiveActiveGroup}
              options={ACTIVE_MATCH_GROUPS.map((group) => ({
                value: group,
                label: t(activeMatchGroupTabKey(group)),
                badgeCount:
                  group === "now" ? badgeCounts.pending : badgeCounts.upcoming,
              }))}
              onChange={setActiveGroup}
            />
          ) : null}
          {segment === "completed" ? (
            <CompletedTimeFilterControl
              value={completedTimeFilter}
              onChange={setCompletedTimeFilter}
            />
          ) : null}
        </View>
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
                          ? formatCompactUtcInBeirut(invite.soonest_time)
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

                    {invite.note ? (
                      <AppText style={appStyles.inviteNote}>
                        {t("matches.invite.noteQuote", { note: invite.note })}
                      </AppText>
                    ) : null}

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

          {showEmptyActiveGroup ? (
            <EmptyState
              title={t(activeMatchGroupEmptyTitleKey(effectiveActiveGroup))}
              body={t(activeMatchGroupEmptyBodyKey(effectiveActiveGroup))}
              action={
                effectiveActiveGroup === "upcoming" ? (
                  <PrimaryButton
                    label={t("matches.create.organiseCta")}
                    onPress={() => startNewMatchCreate()}
                  />
                ) : undefined
              }
            />
          ) : null}

          <View style={appStyles.cardList}>
            {!segmentLoading && !segmentError
              ? activeGroupMatches.map(renderActiveMatch)
              : null}
          </View>
        </>
      ) : (
        <>
          {showEmptyCompleted ? (
            <EmptyState
              title={t(completedTimeFilterEmptyTitleKey(completedTimeFilter))}
              body={t(completedTimeFilterEmptyBodyKey(completedTimeFilter))}
            />
          ) : null}

          <View style={appStyles.cardList}>
            {!segmentLoading && !segmentError
              ? filteredCompletedMatches.map((match) => {
                  // A completed match with no score is the ordinary casual
                  // case now that attendance is what completes a match, so
                  // every result-derived field here can be absent.
                  const scoreLabel = match.score
                    ? formatMatchScore(match.score, match.viewer_side ?? 1)
                    : null;

                  const outcomeLabel =
                    match.viewer_won === null
                      ? t("matches.list.played")
                      : match.viewer_won
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
                  const needsScore = completedMatchNeedsScore(match);

                  return (
                    <MatchCard
                      key={match.match_id}
                      accentBorder
                      status="completed"
                      statusLabel={outcomeLabel}
                      actionLabel={
                        needsScore
                          ? t("matches.list.action.submitScore")
                          : undefined
                      }
                      actionTone="actionable"
                      dateTimeLabel={playedLabel}
                      headline={
                        resolvedOpponent
                          ? buildMatchCardHeadline(t, headlineInput)
                          : (opponentLabel ??
                            (match.result_status
                              ? t(
                                  `matches.results.status.${match.result_status}`,
                                )
                              : t("matches.list.played")))
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
                              won: match.viewer_won === true,
                              score: scoreLabel,
                              title: outcomeLabel,
                            }
                          : undefined
                      }
                      onPress={() =>
                        router.push({
                          pathname: "/match/[id]",

                          params: { id: match.match_id },
                        })
                      }
                      onActionPress={
                        needsScore
                          ? () => setResultMatchId(match.match_id)
                          : undefined
                      }
                      // Footer rather than the action slot: "Submit score" is
                      // what makes a match count towards a rating, so a rematch
                      // must sit beside it, never replace it.
                      footer={
                        match.opponent_names ? (
                          <SecondaryButton
                            label={t("matches.list.action.rematch")}
                            disabled={rematchPending}
                            onPress={() => void startRematch(match.match_id)}
                          />
                        ) : undefined
                      }
                    />
                  );
                })
              : null}
          </View>
        </>
      )}

      <MatchResultSheet
        matchId={resultMatchId}
        visible={resultMatchId != null}
        onClose={() => setResultMatchId(null)}
      />
    </Screen>
  );
}
