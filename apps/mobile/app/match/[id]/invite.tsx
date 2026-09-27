import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import { SettingToggle } from "../../../src/components/AppUi";
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
import {
  canInviteFromState,
  invitePlayerState,
  type InvitePlayerState,
} from "../../../src/lib/invite-player-state";
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

type HubInvited = {
  user_id: string;
  display_name: string;
  status: string;
};

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
  const [searchQuery, setSearchQuery] = useState("");
  // Derived from here down; nothing syncs async data into state through an
  // effect, which the compiler's cascading render rule has already forced out
  // of this codebase twice.
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [noteExpanded, setNoteExpanded] = useState(false);
  const autoInviteStarted = useRef(false);

  const hubQuery = useQuery({
    queryKey: ["match-hub", id],
    queryFn: () => getMatchHub(supabase, id!),
    enabled: Boolean(id),
  });

  const hub = hubQuery.data;
  const participants =
    (hub?.participants as HubParticipant[] | undefined) ?? [];
  // `100` returns this to every accepted participant, not the creator alone:
  // any of them may invite, and hiding who was already asked is what made them
  // ask twice. A decline still reaches only the host and whoever sent it.
  const invitedPlayers =
    (hub?.invited_players as HubInvited[] | undefined) ?? [];
  const matchFull = Boolean(hub && hub.participant_count >= hub.capacity);

  const timeWindow = useMemo(() => (hub ? matchTimeWindow(hub) : null), [hub]);
  const activeWindow = showAllTimes ? null : timeWindow;
  const timeLabel = timeWindow
    ? formatCompactUtcInBeirut(timeWindow.freeFrom)
    : null;

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
    // Refetching the hub is what moves the row, and it is the same fact on the
    // next visit. A second local source would be free to disagree with it.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      showToast(t("matches.invite.sent"));
    },
    onError: (error: unknown) => showToast(t(matchInviteErrorKey(error))),
  });

  /**
   * Separate from inviting a named player, which it used to run alongside.
   * A targeted invite already reaches that player by push, so opening a share
   * sheet on top of it asked the host to send the same thing twice. A link is
   * for somebody who is not on RacketBound at all, and `create_match_invite`
   * has always accepted a null recipient for exactly that.
   */
  const shareLinkMutation = useMutation({
    mutationFn: () => createMatchInvite(supabase, id!),
    onSuccess: (token) =>
      shareMatchInvite(
        t("matches.invite.shareMessage", { url: buildMatchInviteUrl(token) }),
      ),
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

    // No state to set: the row already renders from the hub payload, so
    // recording the invite locally would only add a second render pass for
    // the same result.
    if (
      !canInviteFromState(
        invitePlayerState({
          participants,
          invitedPlayers,
          userId: invitePlayerId,
        }),
      )
    ) {
      return;
    }

    autoInviteStarted.current = true;
    inviteMutation.mutate(invitePlayerId);
    // Auto-invite once when arriving from create-for-player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub, id, invitePlayerId, participants, invitedPlayers]);

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
  const noteHasContent = inviteNote.trim().length > 0;

  function playerInviteState(player: CompatiblePlayerCard): InvitePlayerState {
    return invitePlayerState({
      participants,
      invitedPlayers,
      userId: player.user_id,
    });
  }

  function renderPlayerRow({ item: player }: { item: CompatiblePlayerCard }) {
    const state = playerInviteState(player);
    const canInvite = canInviteFromState(state);
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
          state === "requested"
            ? t("matches.invite.requestedLabel")
            : state === "joined"
              ? t("matches.invite.joinedLabel")
              : state === "invited"
                ? t("matches.invite.invited")
                : state === "superseded"
                  ? t("matches.invite.onHold")
                  : // Re-asking somebody who said no is allowed, but the row
                    // says so, so it cannot happen by accident.
                    state === "declined"
                    ? t("matches.invite.inviteAgain")
                    : t("matches.invite.invitePlayer")
        }
        primaryLoading={
          inviteMutation.isPending &&
          inviteMutation.variables === player.user_id
        }
        // A pending request is the one non-invite state worth tapping: it
        // sends the host to the hub, where accept and decline already live.
        primaryDisabled={
          (!canInvite && state !== "requested") || inviteMutation.isPending
        }
        onProfilePress={() =>
          router.push({
            pathname: "/player/[id]",
            params: { id: player.user_id },
          })
        }
        onPrimaryPress={() => {
          if (state === "requested") {
            if (id) router.push(matchHubRoute(id));
            return;
          }
          if (!canInvite) return;
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
            {activeWindow && timeLabel
              ? t("matches.invite.noPlayersAtTime", { time: timeLabel })
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

  const listHeader = !matchFull ? (
    <View style={styles.toolbar}>
      <View style={[styles.searchField, { flexDirection: rowDirection }]}>
        <Icon name="discover" size={18} color={tennisColors.mutedForeground} />
        <TextInput
          accessibilityLabel={t("matches.invite.searchPlaceholder")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("matches.invite.searchPlaceholder")}
          placeholderTextColor={tennisColors.mutedForeground}
          style={[
            styles.searchInput,
            { writingDirection, textAlign: isRtl ? "right" : "left" },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {timeWindow && timeLabel ? (
        <SettingToggle
          variant="card"
          label={t("matches.invite.timeChipActive", {
            time: timeLabel,
            defaultValue: `Available ${timeLabel}`,
          })}
          value={!showAllTimes}
          onValueChange={(enabled) => setShowAllTimes(!enabled)}
        />
      ) : null}

      <View style={styles.noteBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: noteExpanded }}
          accessibilityLabel={
            noteExpanded
              ? t("matches.invite.noteHide")
              : noteHasContent
                ? t("matches.invite.noteEdit")
                : t("matches.invite.noteLabel")
          }
          onPress={() => setNoteExpanded((open) => !open)}
          style={[styles.noteToggle, { flexDirection: rowDirection }]}
        >
          <AppText style={[styles.noteToggleLabel, { writingDirection }]}>
            {!noteExpanded && noteHasContent
              ? t("matches.invite.noteQuote", {
                  note:
                    inviteNote.trim().length > 42
                      ? `${inviteNote.trim().slice(0, 42)}…`
                      : inviteNote.trim(),
                })
              : t("matches.invite.noteLabel")}
          </AppText>
          <Icon
            name={noteExpanded ? "close" : "add"}
            size={16}
            color={tennisColors.mutedForeground}
          />
        </Pressable>

        {noteExpanded ? (
          <View style={styles.noteEditor}>
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
          </View>
        ) : null}
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <FigmaSubpageHero
        title={t("matches.invite.playersTitle")}
        description={t("matches.invite.playersDescription")}
        onBack={handleBack}
      />

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
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          ListEmptyComponent={renderListEmpty}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
        {/*
          The link is its own action now. It used to fire alongside every
          targeted invite, which sent the same match to one player twice --
          once by push, once by whatever they picked in the share sheet.
        */}
        <FigmaSecondaryButton
          label={t("matches.invite.shareLink")}
          loading={shareLinkMutation.isPending}
          onPress={() => shareLinkMutation.mutate()}
        />
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
    toolbar: {
      gap: 8,
      paddingBottom: 8,
    },
    searchField: {
      alignItems: "center",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: tennisRadii.lg,
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 10,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.primaryDark,
    },
    noteBlock: {
      gap: 4,
      marginTop: 2,
    },
    noteToggle: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      minHeight: 32,
      paddingVertical: 0,
    },
    noteToggleLabel: {
      flex: 1,
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    noteEditor: {
      gap: 4,
    },
    noteInput: {
      minHeight: 56,
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
      marginTop: 24,
    },
    emptyState: {
      gap: 12,
      paddingTop: 4,
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
      gap: 10,
      paddingTop: 12,
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
      alignSelf: "stretch",
      minHeight: minTouchTargetPx,
      borderRadius: tennisRadii.md,
    },
  }),
);
