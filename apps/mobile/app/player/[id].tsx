import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blockUser, discoverCompatiblePlayers } from "@tennis-lebanon/api";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";
import { supabase } from "../../src/lib/supabase";

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const playerQuery = useQuery({
    queryKey: ["player-detail", id],
    queryFn: async () => {
      const players = await discoverCompatiblePlayers(supabase, {
        requireAvailabilityOverlap: false,
        levelWindow: 4,
        limit: 50,
      });
      return players.find((player) => player.user_id === id) ?? null;
    },
    enabled: Boolean(id),
  });

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

  const player = playerQuery.data;

  return (
    <Screen title={player?.display_name ?? t("discover.playersTab")}>
      {player ? (
        <View style={formStyles.summary}>
          <Text style={formStyles.summaryLabel}>
            {t("onboarding.review.skill")}
          </Text>
          <Text style={formStyles.summaryValue}>
            {t(`skillBands.${player.skill_band}`)}
          </Text>
          <Text style={formStyles.summaryLabel}>{t("playIntent.either")}</Text>
          <Text style={formStyles.summaryValue}>
            {t(`playIntent.${player.play_intent}`)}
          </Text>
        </View>
      ) : null}

      <PrimaryButton
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
      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}
