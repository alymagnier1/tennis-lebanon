import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createMatchInvite,
  discoverCompatiblePlayers,
  getMatchHub,
  publishMatch,
  type CompatiblePlayerCard,
} from "@tennis-lebanon/api";
import {
  discoveryFiltersForMatchInvite,
  widenLevelWindow,
} from "@tennis-lebanon/domain";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";
import { PlayerCard, PlayerInviteAction } from "../../../src/components/AppUi";
import { AppText } from "../../../src/components/AppText";
import {
  PrimaryButton,
  SecondaryButton,
  formStyles,
} from "../../../src/components/FormUi";
import { matchHubRoute } from "../../../src/lib/routes";
import { buildMatchInviteUrl } from "../../../src/lib/invite-link";
import { useLayoutDirection } from "../../../src/lib/layout-direction";
import { useResponsiveLayout } from "../../../src/lib/responsive";
import { supabase } from "../../../src/lib/supabase";
import { zoneLabelFromList } from "../../../src/lib/zones";

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
  const { horizontalPadding, titleFontSize } = useResponsiveLayout();
  const { writingDirection } = useLayoutDirection();
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [requireOverlap, setRequireOverlap] = useState(true);
  const [levelWindow, setLevelWindow] = useState(1);
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

  const playerFilters = useMemo(() => {
    if (!hub) return null;
    return {
      ...discoveryFiltersForMatchInvite({
        format: hub.format,
        intent: hub.intent,
      }),
      requireAvailabilityOverlap: requireOverlap,
      levelWindow,
    };
  }, [hub, levelWindow, requireOverlap]);

  const playersQuery = useQuery({
    queryKey: ["match-invite-players", id, playerFilters],
    queryFn: () => discoverCompatiblePlayers(supabase, playerFilters!),
    enabled:
      Boolean(hub?.viewer_is_creator) && !matchFull && Boolean(playerFilters),
  });

  const filteredPlayers = useMemo(
    () => filterPlayersBySearch(playersQuery.data ?? [], searchQuery),
    [playersQuery.data, searchQuery],
  );

  const inviteMutation = useMutation({
    mutationFn: (playerId: string) =>
      createMatchInvite(supabase, id!, playerId),
    onSuccess: async (token, playerId) => {
      setInvitedIds((current) =>
        current.includes(playerId) ? current : [...current, playerId],
      );
      await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      Alert.alert(t("matches.invite.sent"));
      await Share.share({
        message: t("matches.invite.shareMessage", {
          url: buildMatchInviteUrl(token),
        }),
      });
    },
    onError: () => Alert.alert(t("matches.invite.error")),
  });

  useEffect(() => {
    if (
      !invitePlayerId ||
      !id ||
      !hub?.viewer_is_creator ||
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
  }, [hub?.viewer_is_creator, id, invitePlayerId, participants]);

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
    onError: () => Alert.alert(t("matches.create.publishError")),
  });

  const isDraft = hub?.status === "draft";

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

    return (
      <PlayerCard
        name={player.display_name}
        avatarPath={player.avatar_path}
        levelLabel={t(`skillBands.${player.skill_band}`)}
        locationLabel={zoneLabelFromList(
          player.zones,
          i18n.resolvedLanguage ?? i18n.language,
        )}
        trailing={
          <PlayerInviteAction
            label={t("matches.invite.invitePlayer")}
            invitedLabel={t("matches.invite.invited")}
            invited={state === "invited"}
            disabled={inviteMutation.isPending}
            onPress={() => inviteMutation.mutate(player.user_id)}
          />
        }
      />
    );
  }

  function renderListEmpty() {
    if (playersQuery.isLoading) {
      return (
        <ActivityIndicator
          accessibilityLabel={t("discover.loading")}
          style={styles.listLoader}
        />
      );
    }

    if (playersQuery.isError) {
      return (
        <AppText style={formStyles.errorText}>{t("discover.error")}</AppText>
      );
    }

    if ((playersQuery.data?.length ?? 0) === 0) {
      return (
        <View style={styles.emptyState}>
          <AppText style={formStyles.description}>
            {t("matches.invite.noPlayers")}
          </AppText>
          <SecondaryButton
            label={t("discover.widenLevel")}
            onPress={() => setLevelWindow(widenLevelWindow(levelWindow))}
          />
          <SecondaryButton
            label={t("discover.toggleOverlap")}
            onPress={() => setRequireOverlap(false)}
          />
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <AppText style={formStyles.hintText}>
          {t("matches.invite.searchEmpty")}
        </AppText>
      );
    }

    return null;
  }

  const screenPadding = Math.max(horizontalPadding, insets.left, insets.right);

  if (hubQuery.isError) {
    return (
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingHorizontal: screenPadding },
        ]}
      >
        <AppText style={formStyles.errorText}>
          {t("matches.hub.loadError")}
        </AppText>
      </View>
    );
  }

  if (hubQuery.isLoading || !hub) {
    return (
      <View
        style={[
          styles.screen,
          styles.centered,
          { paddingTop: insets.top, paddingHorizontal: screenPadding },
        ]}
      >
        <ActivityIndicator accessibilityLabel={t("discover.loading")} />
      </View>
    );
  }

  if (!hub.viewer_is_creator) {
    return <Redirect href={{ pathname: "/match/[id]", params: { id: id! } }} />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: screenPadding }]}>
        <AppText
          accessibilityRole="header"
          style={[styles.title, { fontSize: titleFontSize, writingDirection }]}
          maxLines={2}
        >
          {t("matches.invite.playersTitle")}
        </AppText>
        <AppText style={[styles.description, { writingDirection }]}>
          {t("matches.invite.playersDescription")}
        </AppText>
        <TextInput
          accessibilityLabel={t("matches.invite.searchPlaceholder")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("matches.invite.searchPlaceholder")}
          placeholderTextColor={colors.neutral[500]}
          style={[styles.searchInput, { writingDirection }]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {matchFull ? (
        <View
          style={[styles.matchFullBody, { paddingHorizontal: screenPadding }]}
        >
          <AppText style={formStyles.hintText}>
            {t("matches.invite.matchFull")}
          </AppText>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredPlayers}
          keyExtractor={(player) => player.user_id}
          renderItem={renderPlayerRow}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: screenPadding },
          ]}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          ListEmptyComponent={renderListEmpty}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={playersQuery.isRefetching || hubQuery.isRefetching}
              onRefresh={async () => {
                await hubQuery.refetch();
                await playersQuery.refetch();
              }}
            />
          }
        />
      )}

      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: screenPadding,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
        <AppText style={[styles.footerHint, { writingDirection }]}>
          {isDraft
            ? t("matches.invite.matchDraftHint")
            : t("matches.invite.matchLiveHint")}
        </AppText>
        <PrimaryButton
          label={
            isDraft
              ? t("matches.invite.publishMatch")
              : t("matches.invite.goToMatch")
          }
          loading={finishMutation.isPending}
          onPress={() => finishMutation.mutate()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.neutral[900],
    fontWeight: typography.weight.bold,
  },
  description: {
    color: colors.neutral[700],
    fontSize: typography.size.md,
    lineHeight: 24,
  },
  searchInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.neutral[900],
    fontSize: typography.size.md,
    backgroundColor: colors.neutral[0],
  },
  list: {
    flex: 1,
  },
  matchFullBody: {
    flex: 1,
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  listSeparator: {
    height: spacing.md,
  },
  listLoader: {
    marginTop: spacing.xl,
  },
  emptyState: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    backgroundColor: colors.neutral[0],
  },
  footerHint: {
    color: colors.neutral[500],
    fontSize: typography.size.sm,
    textAlign: "center",
  },
});
