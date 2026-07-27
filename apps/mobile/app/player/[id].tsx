import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  blockUser,
  createMatchInvite,
  getPublicPlayerCard,
  listMyMatches,
  type MyMatchRow,
} from "@tennis-lebanon/api";
import { isInviteableHostedMatch } from "@tennis-lebanon/domain";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";
import { formatUtcInBeirut } from "../../src/lib/beirut-time";
import { publicPlayerLevelLabel } from "../../src/lib/player-level-label";
import { supabase } from "../../src/lib/supabase";
import { CREATE_MATCH_ROUTE, playerReportRoute } from "../../src/lib/routes";

function sortBySoonestTime(a: MyMatchRow, b: MyMatchRow): number {
  if (!a.soonest_time && !b.soonest_time) return 0;
  if (!a.soonest_time) return 1;
  if (!b.soonest_time) return -1;
  return a.soonest_time.localeCompare(b.soonest_time);
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [invitingMatchId, setInvitingMatchId] = useState<string | null>(null);

  const playerQuery = useQuery({
    queryKey: ["player-detail", id],
    queryFn: () => getPublicPlayerCard(supabase, id!),
    enabled: Boolean(id),
  });

  const inviteableMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });

  const inviteableMatches = useMemo(
    () =>
      (inviteableMatchesQuery.data ?? [])
        .filter(isInviteableHostedMatch)
        .sort(sortBySoonestTime),
    [inviteableMatchesQuery.data],
  );

  const blockMutation = useMutation({
    mutationFn: () => blockUser(supabase, id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
      await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });
      Alert.alert(t("discover.blockSuccess"));
      router.back();
    },
    onError: () => {
      Alert.alert(t("discover.blockError"));
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (matchId: string) => {
      setInvitingMatchId(matchId);
      return createMatchInvite(supabase, matchId, id!);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-match-invites"] });
      Alert.alert(t("matches.invite.sent"));
    },
    onError: () => Alert.alert(t("matches.invite.error")),
    onSettled: () => setInvitingMatchId(null),
  });

  const player = playerQuery.data;

  return (
    <Screen title={player?.display_name ?? t("discover.playersTab")}>
      {playerQuery.isError ? (
        <Text style={formStyles.errorText}>
          {t("discover.playerLoadError")}
        </Text>
      ) : null}

      {player ? (
        <View style={formStyles.summary}>
          <Text style={formStyles.summaryLabel}>
            {t("onboarding.review.skill")}
          </Text>
          <Text style={formStyles.summaryValue}>
            {publicPlayerLevelLabel(player, t)}
          </Text>
          <Text style={formStyles.summaryLabel}>
            {t("discover.playIntentLabel")}
          </Text>
          <Text style={formStyles.summaryValue}>
            {t(`playIntent.${player.play_intent}`)}
          </Text>
        </View>
      ) : null}

      {inviteableMatches.length > 0 ? (
        <View>
          <Text style={formStyles.summaryLabel}>
            {t("matches.invite.pickMatch")}
          </Text>
          {inviteableMatches.map((match) => (
            <View key={match.match_id} style={formStyles.card}>
              <Text style={formStyles.summaryLabel}>
                {t(`formats.${match.format}`)} ·{" "}
                {t(`matches.status.${match.status}`)}
              </Text>
              <Text style={formStyles.summaryValue}>
                {match.soonest_time
                  ? formatUtcInBeirut(match.soonest_time)
                  : t("matches.invite.noTimeYet")}
              </Text>
              <Text style={formStyles.hintText}>
                {t("discover.spotsRemaining", {
                  count: match.capacity - match.participant_count,
                })}{" "}
                · {match.participant_count}/{match.capacity}
              </Text>
              {match.notes ? (
                <Text style={formStyles.summaryValue}>{match.notes}</Text>
              ) : null}
              <PrimaryButton
                label={t("matches.invite.inviteToOpenMatch")}
                loading={
                  inviteMutation.isPending &&
                  invitingMatchId === match.match_id
                }
                disabled={
                  inviteMutation.isPending &&
                  invitingMatchId !== null &&
                  invitingMatchId !== match.match_id
                }
                onPress={() => inviteMutation.mutate(match.match_id)}
              />
            </View>
          ))}
        </View>
      ) : null}

      <SecondaryButton
        label={t("matches.create.cta")}
        onPress={() => router.push(CREATE_MATCH_ROUTE)}
      />

      {player ? (
        <>
          <SecondaryButton
            label={t("discover.reportPlayer")}
            onPress={() => router.push(playerReportRoute(id!))}
          />
          <SecondaryButton
            label={t("discover.blockPlayer")}
            loading={blockMutation.isPending}
            onPress={() =>
              Alert.alert(
                t("discover.blockConfirmTitle"),
                t("discover.blockConfirmBody"),
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("discover.blockPlayer"),
                    style: "destructive",
                    onPress: () => blockMutation.mutate(),
                  },
                ],
              )
            }
          />
        </>
      ) : null}
      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}

