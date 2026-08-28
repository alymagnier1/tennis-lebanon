import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import {
  createMatchInvite,
  discoverCompatiblePlayers,
  getMatchHub,
  publishMatch,
  type CompatiblePlayerCard,
} from "@tennis-lebanon/api";
import {
  discoveryFiltersForMatchInvite,
  PLAYER_NOTE_MAX,
  sanitizePlayerNote,
  viewerMayInvite,
} from "@tennis-lebanon/domain";
import { AppText } from "../../../src/components/AppText";
import { DiscoverPlayerCard } from "../../../src/components/discover/DiscoverPlayerCard";
import { Icon } from "../../../src/components/Icon";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  FigmaSubpageHero,
} from "../../../src/components/onboarding-ui";
import { clubNamesFromList } from "../../../src/lib/match-clubs";
import { formatMatchesPlayedLabel } from "../../../src/lib/matches-played-label";
import { publicPlayerLevelChip } from "../../../src/lib/player-level-label";
import { discoverPlayerAvailabilityTags } from "../../../src/lib/discover-availability-tag";
import {
  goBackOrReplace,
  MATCHES_TAB_ROUTE,
} from "../../../src/lib/navigation";
import { matchHubRoute } from "../../../src/lib/routes";
import {
  buildMatchInviteUrl,
  matchInviteErrorKey,
  shareMatchInvite,
} from "../../../src/lib/invite-link";
import { useToast } from "../../../src/providers/ToastProvider";
import { useLayoutDirection } from "../../../src/lib/layout-direction";
import { supabase } from "../../../src/lib/supabase";
import { matchTimeWindow } from "../../../src/lib/match-invite-filters";
import { zoneIdsFromPlayerZones } from "../../../src/lib/prefill-create-match-for-player";
import { formatCompactUtcInBeirut } from "../../../src/lib/beirut-time";
import { zoneLabelFromList } from "../../../src/lib/zones";
import { tennisFontFamily } from "../../../src/hooks/useTennisFonts";
import { createLiveSheet } from "../../../src/theme/create-live-sheet";
import { tennisColors, tennisRadii } from "../../../src/theme/tennis-tokens";

type HubParticipant = {
  user_id: string;
  display_name: string;
  status: string;
};

function isAlreadyInMatch(
  participants: HubParticipant[],
  userId: string,
): boolean {
  return participants.some(
    (participant) =>
      participant.user_id === userId &&
      ["accepted", "invited", "requested"].includes(participant.status),
  );
}

function filterPlayersBySearch(
  players: CompatiblePlayerCard[],
  query: string,
): CompatiblePlayerCard[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return players;
  return players.filter((player) =>
    player.display_name.toLowerCase().includes(normalized),
  );
}

export default function MatchInvitePlayersScreen() {
  const { id, invitePlayerId } = useLocalSearchParams<{
    id: string;
    invitePlayerId?: string;
  }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { writingDirection, isRtl, rowDirection } = useLayoutDirection();
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // Derived from here down; nothing syncs async data into state through an
  // effect, which the compiler's cascading render rule has already forced out
  // of this codebase twice.
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const autoInviteStarted = useRef(false);

  const hubQuery = useQuery({
    queryKey: ["match-hub", id],
    queryFn: () => getMatchHub(supabase, id!),
    enabled: Boolean(id),
  });

  const hub = hubQuery.data;
  const participants =
    (hub?.participants as HubParticipant[] | undefined) ?? [];
  const matchFull = Boolean(hub && hub.participant_count >= hub.capacity);

  const timeWindow = useMemo(() => (hub ? matchTimeWindow(hub) : null), [hub]);
  const activeWindow = showAllTimes ? null : timeWindow;

  const playerFilters = useMemo(() => {
    if (!hub) return null;
    return discoveryFiltersForMatchInvite({
      format: hub.format,
      intent: hub.intent,
      zoneIds: zoneIdsFromPlayerZones(hub.zones),
      freeFrom: activeWindow?.freeFrom,
      freeTo: activeWindow?.freeTo,
    });
  }, [activeWindow, hub]);

  const playersQuery = useQuery({
    queryKey: ["match-invite-players", id, playerFilters],
    queryFn: () => discoverCompatiblePlayers(supabase, playerFilters!),
    enabled:
      Boolean(hub && viewerMayInvite(hub)) &&
      !matchFull &&
      Boolean(playerFilters),
  });

  const filteredPlayers = useMemo(
    () => filterPlayersBySearch(playersQuery.data ?? [], searchQuery),
    [playersQuery.data, searchQuery],
  );

  const inviteMutation = useMutation({
    mutationFn: (playerId: string) =>
      createMatchInvite(
        supabase,
        id!,
        playerId,
        sanitizePlayerNote(inviteNote),
      ),
    onSuccess: async (token, playerId) => {
      setInvitedIds((current) =>
        current.includes(playerId) ? current : [...current, playerId],
      );
      await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      showToast(t("matches.invite.sent"));
      await shareMatchInvite(
        t("matches.invite.shareMessage", {
          url: buildMatchInviteUrl(token),
        }),
      );
    },
    onError: (error: unknown) => showToast(t(matchInviteErrorKey(error))),
  });

  useEffect(() => {
    if (
      !invitePlayerId ||
      !id ||
      !(hub && viewerMayInvite(hub)) ||
      autoInviteStarted.current
    ) {
      return;
    }

    // No state to set: the row already renders as invited when the player is
    // in the match, so pushing them into invitedIds only added a second
    // render pass for the same result.
    if (isAlreadyInMatch(participants, invitePlayerId)) {
      return;
    }

    autoInviteStarted.current = true;
    inviteMutation.mutate(invitePlayerId);
    // Auto-invite once when arriving from create-for-player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub, id, invitePlayerId, participants]);

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (hub?.status === "draft") {
        await publishMatch(supabase, id!);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      router.replace(matchHubRoute(id!));
    },
    onError: () => showToast(t("matches.create.publishError")),
  });

  const isDraft = hub?.status === "draft";
  const handleBack = () =>
    goBackOrReplace(id ? matchHubRoute(id) : MATCHES_TAB_ROUTE);

  function playerInviteState(
    player: CompatiblePlayerCard,
  ): "invite" | "invited" {
    if (
      invitedIds.includes(player.user_id) ||
      isAlreadyInMatch(participants, player.user_id)
    ) {
      return "invited";
    }
    return "invite";
  }

  function renderPlayerRow({ item: player }: { item: CompatiblePlayerCard }) {
    const state = playerInviteState(player);
    const invited = state === "invited";
    const locale = i18n.resolvedLanguage ?? i18n.language;

    return (
      <DiscoverPlayerCard
        player={player}
        name={player.display_name}
        locationLabel={zoneLabelFromList(player.zones, locale)}
        levelBadgeLabel={publicPlayerLevelChip(player, t)}
        matchesPlayedLabel={formatMatchesPlayedLabel(
          player.completed_match_count,
          t,
        )}
        availabilityTags={discoverPlayerAvailabilityTags(player, false, t)}
        clubsTag={
          clubNamesFromList(player.favorite_clubs).slice(0, 2).join(" · ") ||
          null
        }
        profileAccessibilityLabel={t("discover.openPlayerProfile", {
          name: player.display_name,
        })}
        primaryLabel={
          invited
            ? t("matches.invite.invited")
            : t("matches.invite.invitePlayer")
        }
        primaryLoading={
          inviteMutation.isPending &&
          inviteMutation.variables === player.user_id
        }
        primaryDisabled={invited || inviteMutation.isPending}
        onProfilePress={() =>
          router.push({
            pathname: "/player/[id]",
            params: { id: player.user_id },
          })
        }
        onPrimaryPress={() => {
          if (invited) return;
          inviteMutation.mutate(player.user_id);
        }}
      />
    );
  }

  function renderListEmpty() {
    if (playersQuery.isLoading) {
      return (
        <ActivityIndicator
          accessibilityLabel={t("common.loading")}
          color={tennisColors.primary}
          style={styles.listLoader}
        />
      );
    }

    if (playersQuery.isError) {
      return <AppText style={styles.errorText}>{t("discover.error")}</AppText>;
    }

    if ((playersQuery.data?.length ?? 0) === 0) {
      // Name the filter that emptied it. The old copy sent the host to Discover
      // to "widen filters" that were never there, and never said the match's
      // own hour was what had excluded everybody.
      return (
        <View style={styles.emptyState}>
          <AppText style={styles.emptyText}>
            {activeWindow
              ? t("matches.invite.noPlayersAtTime", {
                  time: formatCompactUtcInBeirut(activeWindow.freeFrom),
                })
              : t("matches.invite.noPlayersHere")}
          </AppText>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <AppText style={styles.emptyText}>
          {t("matches.invite.searchEmpty")}
        </AppText>
      );
    }

    return null;
  }

  const searchField = (
    <View style={styles.searchWrap}>
      <View
        style={[
          styles.searchIcon,
          isRtl ? { right: 14, left: undefined } : null,
        ]}
      >
        <Icon name="discover" size={16} color={tennisColors.mutedForeground} />
      </View>
      <TextInput
        accessibilityLabel={t("matches.invite.searchPlaceholder")}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t("matches.invite.searchPlaceholder")}
        placeholderTextColor={tennisColors.mutedForeground}
        style={[
          styles.searchInput,
          { writingDirection, textAlign: isRtl ? "right" : "left" },
          isRtl ? { paddingLeft: 12, paddingRight: 40 } : null,
        ]}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );

  // Always rendered, not only when the list is empty. The controls used to
  // live inside the empty state, so a host looking at twenty mediocre
  // candidates had none at all and only a host with zero results got any --
  // backwards, and the reason a narrowing filter could not be trusted on by
  // default.
  const filterBar = (
    <View style={styles.filterBar}>
      {activeWindow ? (
        <AppText style={[styles.filterSummary, { writingDirection }]}>
          {t("matches.invite.filteredToTime", {
            time: formatCompactUtcInBeirut(activeWindow.freeFrom),
          })}
        </AppText>
      ) : null}
      <View style={[styles.filterActions, { flexDirection: rowDirection }]}>
        {timeWindow ? (
          <FigmaSecondaryButton
            label={
              showAllTimes
                ? t("matches.invite.onlyMatchTime")
                : t("matches.invite.showAllTimes")
            }
            onPress={() => setShowAllTimes((current) => !current)}
          />
        ) : null}
      </View>
    </View>
  );

  if (hubQuery.isError) {
    return (
      <View style={styles.screen}>
        <FigmaSubpageHero
          title={t("matches.invite.playersTitle")}
          onBack={handleBack}
        />
        <View style={styles.paddedBody}>
          <AppText style={styles.errorText}>
            {t("matches.hub.loadError")}
          </AppText>
          <FigmaSecondaryButton
            label={t("common.retry")}
            onPress={() => void hubQuery.refetch()}
          />
        </View>
      </View>
    );
  }

  if (hubQuery.isLoading || !hub) {
    return (
      <View style={styles.screen}>
        <FigmaSubpageHero
          title={t("matches.invite.playersTitle")}
          onBack={handleBack}
        />
        <View style={styles.centered}>
          <ActivityIndicator
            accessibilityLabel={t("common.loading")}
            color={tennisColors.primary}
          />
        </View>
      </View>
    );
  }

  // Not creator-only. `create_match_invite` authorises any accepted
  // participant, deliberately -- it is what lets somebody who joined a doubles
  // match go and find the fourth. Gating this screen on the host left them
  // with nowhere to do it once Discover stopped inviting.
  if (!viewerMayInvite(hub)) {
    return <Redirect href={{ pathname: "/match/[id]", params: { id: id! } }} />;
  }

  return (
    <View style={styles.screen}>
      <FigmaSubpageHero
        title={t("matches.invite.playersTitle")}
        description={t("matches.invite.playersDescription")}
        onBack={handleBack}
      >
        {searchField}
        {filterBar}
      </FigmaSubpageHero>

      {!matchFull ? (
        <View style={styles.noteWrap}>
          <AppText style={[styles.noteLabel, { writingDirection }]}>
            {t("matches.invite.noteLabel")}
          </AppText>
          <TextInput
            accessibilityLabel={t("matches.invite.noteLabel")}
            value={inviteNote}
            onChangeText={(value) =>
              setInviteNote(value.slice(0, PLAYER_NOTE_MAX))
            }
            placeholder={t("matches.invite.notePlaceholder")}
            placeholderTextColor={tennisColors.mutedForeground}
            style={[
              styles.noteInput,
              { writingDirection, textAlign: isRtl ? "right" : "left" },
            ]}
            multiline
            maxLength={PLAYER_NOTE_MAX}
          />
          <View style={[styles.noteMetaRow, { flexDirection: rowDirection }]}>
            <AppText style={[styles.noteHint, { writingDirection, flex: 1 }]}>
              {t("matches.invite.noteHint")}
            </AppText>
            <AppText style={styles.noteCounter}>
              {t("matches.invite.noteCounter", {
                count: inviteNote.length,
                max: PLAYER_NOTE_MAX,
              })}
            </AppText>
          </View>
        </View>
      ) : null}

      {matchFull ? (
        <View style={styles.paddedBody}>
          <AppText style={styles.emptyText}>
            {t("matches.invite.matchFull")}
          </AppText>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredPlayers}
          keyExtractor={(player) => player.user_id}
          renderItem={renderPlayerRow}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          ListEmptyComponent={renderListEmpty}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={playersQuery.isRefetching || hubQuery.isRefetching}
              tintColor={tennisColors.primary}
              onRefresh={async () => {
                await hubQuery.refetch();
                await playersQuery.refetch();
              }}
            />
          }
        />
      )}

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <AppText style={[styles.footerHint, { writingDirection }]}>
          {isDraft
            ? t("matches.invite.matchDraftHint")
            : t("matches.invite.matchLiveHint")}
        </AppText>
        <FigmaPrimaryButton
          label={
            isDraft
              ? t("matches.invite.publishMatch")
              : t("matches.invite.goToMatch")
          }
          loading={finishMutation.isPending}
          onPress={() => finishMutation.mutate()}
          style={styles.footerButton}
        />
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    paddedBody: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 12,
    },
    filterBar: {
      gap: 8,
      paddingBottom: 4,
    },
    filterSummary: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    filterActions: {
      gap: 8,
      flexWrap: "wrap",
    },
    searchWrap: {
      position: "relative",
      marginTop: 16,
    },
    searchIcon: {
      position: "absolute",
      left: 14,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      zIndex: 1,
    },
    searchInput: {
      minHeight: 44,
      paddingVertical: 12,
      paddingLeft: 40,
      paddingRight: 12,
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.md,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.primaryDark,
    },
    noteWrap: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tennisColors.border,
    },
    noteLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      color: tennisColors.primaryDark,
    },
    noteInput: {
      minHeight: 64,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: tennisColors.card,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: tennisRadii.md,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.primaryDark,
      textAlignVertical: "top",
    },
    noteMetaRow: {
      gap: 8,
      alignItems: "flex-start",
    },
    noteHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    noteCounter: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.mutedForeground,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      flexGrow: 1,
    },
    listSeparator: {
      height: 12,
    },
    listLoader: {
      marginTop: 32,
    },
    emptyState: {
      gap: 12,
      paddingTop: 16,
    },
    emptyText: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
    errorText: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.danger,
    },
    footer: {
      gap: 8,
      paddingTop: 10,
      paddingHorizontal: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tennisColors.border,
      backgroundColor: tennisColors.background,
    },
    footerHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
      textAlign: "center",
    },
    footerButton: {
      alignSelf: "center",
      minHeight: minTouchTargetPx,
      minWidth: 168,
      paddingVertical: 10,
      paddingHorizontal: 28,
      borderRadius: tennisRadii.md,
    },
  }),
);
