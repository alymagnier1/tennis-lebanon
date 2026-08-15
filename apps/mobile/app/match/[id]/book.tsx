import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getMatchHub } from "@tennis-lebanon/api";
import { ClubsDirectoryList } from "../../../src/components/ClubsDirectoryList";
import { AppText } from "../../../src/components/AppText";
import {
  ErrorNotice,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../../src/components/FormUi";
import { formatUtcSlotInBeirut } from "../../../src/lib/beirut-time";
import { useClubsDirectory } from "../../../src/hooks/useClubsDirectory";
import {
  clubDetailRoute,
  matchBookExternalRoute,
  matchHubRoute,
} from "../../../src/lib/routes";
import { supabase } from "../../../src/lib/supabase";

export default function MatchBookCourtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  const hubQuery = useQuery({
    queryKey: ["match-hub", id],
    queryFn: () => getMatchHub(supabase, id!),
    enabled: Boolean(id),
  });

  const isHost = hubQuery.data?.viewer_is_creator === true;

  const matchZoneIds = useMemo(() => {
    const zones = (hubQuery.data?.zones as { id: string }[] | undefined) ?? [];
    return zones.map((zone) => zone.id);
  }, [hubQuery.data?.zones]);

  const clubsQuery = useClubsDirectory(isHost ? matchZoneIds : []);

  const agreedSlot = useMemo(() => {
    const selected = hubQuery.data?.selected_time_option_id;
    if (!selected) return null;
    return (
      hubQuery.data?.proposed_times.find((slot) => slot.id === selected) ?? null
    );
  }, [hubQuery.data]);

  if (hubQuery.isLoading) {
    return (
      <Screen title={t("matches.booking.title")}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </Screen>
    );
  }

  if (hubQuery.data && !isHost) {
    return (
      <Screen title={t("matches.booking.title")}>
        <ErrorNotice>{t("matches.booking.hostOnly")}</ErrorNotice>
        <SecondaryButton
          label={t("common.back")}
          onPress={() => router.replace(matchHubRoute(id!))}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("matches.booking.title")}
      description={t("matches.booking.browseClubsDescription")}
    >
      {agreedSlot ? (
        <View style={formStyles.compactCard}>
          <AppText style={formStyles.compactCardTitle}>
            {t("matches.booking.confirmTime")}
          </AppText>
          <AppText>
            {formatUtcSlotInBeirut(agreedSlot.starts_at, agreedSlot.ends_at)}
          </AppText>
          <AppText style={formStyles.description}>
            {t("matches.booking.payAtClubNote")}
          </AppText>
        </View>
      ) : null}

      <AppText style={formStyles.summaryLabel}>
        {t("matches.booking.selectClub")}
      </AppText>
      <ClubsDirectoryList
        clubsQuery={clubsQuery}
        matchId={id}
        onClubPress={(clubId) =>
          router.push(clubDetailRoute(clubId, { matchId: id! }))
        }
      />

      <SecondaryButton
        label={t("matches.booking.bookedOffAppCta")}
        onPress={() => router.push(matchBookExternalRoute(id!))}
      />
    </Screen>
  );
}
