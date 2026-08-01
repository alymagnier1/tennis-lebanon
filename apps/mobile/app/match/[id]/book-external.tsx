import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmExternalCourt,
  getClubDetail,
  getMatchHub,
} from "@tennis-lebanon/api";
import { formatPriceMinor } from "@tennis-lebanon/domain";
import { ClubsDirectoryList } from "../../../src/components/ClubsDirectoryList";
import { AppText } from "../../../src/components/AppText";
import {
  Choice,
  PrimaryButton,
  Screen,
  formStyles,
} from "../../../src/components/FormUi";
import { formatUtcSlotInBeirut } from "../../../src/lib/beirut-time";
import { useClubsDirectory } from "../../../src/hooks/useClubsDirectory";
import { matchHubRoute } from "../../../src/lib/routes";
import { supabase } from "../../../src/lib/supabase";

export default function MatchBookExternalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [courtId, setCourtId] = useState<string | null>(null);

  const hubQuery = useQuery({
    queryKey: ["match-hub", id],
    queryFn: () => getMatchHub(supabase, id!),
    enabled: Boolean(id),
  });

  const matchZoneIds = useMemo(() => {
    const zones = (hubQuery.data?.zones as { id: string }[] | undefined) ?? [];
    return zones.map((zone) => zone.id);
  }, [hubQuery.data?.zones]);

  const clubsQuery = useClubsDirectory(matchZoneIds);

  const clubQuery = useQuery({
    queryKey: ["club-detail", selectedClubId],
    queryFn: () => getClubDetail(supabase, selectedClubId!),
    enabled: Boolean(selectedClubId),
  });

  const agreedSlot = useMemo(() => {
    const selected = hubQuery.data?.selected_time_option_id;
    if (!selected) return null;
    return (
      hubQuery.data?.proposed_times.find((slot) => slot.id === selected) ?? null
    );
  }, [hubQuery.data]);

  const selectedCourt = useMemo(
    () => clubQuery.data?.courts.find((court) => court.court_id === courtId),
    [clubQuery.data?.courts, courtId],
  );

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmExternalCourt(supabase, {
        matchId: id!,
        courtId: courtId!,
        startsAt: agreedSlot!.starts_at,
        endsAt: agreedSlot!.ends_at,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      await queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      Alert.alert(t("matches.booking.externalSuccess"));
      router.replace(matchHubRoute(id!));
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      Alert.alert(
        message.includes("court_already_booked")
          ? t("matches.booking.courtAlreadyBooked")
          : t("matches.booking.externalError"),
      );
    },
  });

  function handleSelectClub(clubId: string) {
    setSelectedClubId(clubId);
    setCourtId(null);
  }

  function handleConfirm() {
    if (!clubQuery.data || !selectedCourt || !agreedSlot) {
      return;
    }

    Alert.alert(
      t("matches.booking.bookedOffAppConfirmTitle"),
      t("matches.booking.bookedOffAppConfirmBody", {
        club: clubQuery.data.name,
        court: selectedCourt.name,
        time: formatUtcSlotInBeirut(agreedSlot.starts_at, agreedSlot.ends_at),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("matches.booking.bookedOffAppConfirm"),
          onPress: () => confirmMutation.mutate(),
        },
      ],
    );
  }

  const canConfirm = Boolean(
    selectedClubId && courtId && agreedSlot && !confirmMutation.isPending,
  );

  return (
    <Screen
      title={t("matches.booking.bookedOffAppTitle")}
      description={t("matches.booking.bookedOffAppDescription")}
    >
      {hubQuery.isLoading ? (
        <ActivityIndicator accessibilityLabel={t("discover.loading")} />
      ) : null}

      {agreedSlot ? (
        <View style={formStyles.compactCard}>
          <AppText style={formStyles.compactCardTitle}>
            {t("matches.booking.confirmTime")}
          </AppText>
          <AppText>
            {formatUtcSlotInBeirut(agreedSlot.starts_at, agreedSlot.ends_at)}
          </AppText>
        </View>
      ) : (
        <AppText style={formStyles.errorText}>
          {t("matches.booking.bookedOffAppNoTime")}
        </AppText>
      )}

      <AppText style={formStyles.summaryLabel}>
        {t("matches.booking.selectClub")}
      </AppText>
      <ClubsDirectoryList
        clubsQuery={clubsQuery}
        onClubPress={handleSelectClub}
      />

      {selectedClubId ? (
        <View style={formStyles.compactCard}>
          <AppText style={formStyles.compactCardTitle}>
            {clubQuery.data?.name ?? t("discover.loading")}
          </AppText>

          {clubQuery.isLoading ? <ActivityIndicator /> : null}

          {clubQuery.data && clubQuery.data.courts.length > 0 ? (
            <View style={formStyles.stack}>
              <AppText style={formStyles.summaryLabel}>
                {t("matches.booking.selectCourt")}
              </AppText>
              {clubQuery.data.courts.map((court) => {
                const price = formatPriceMinor(
                  court.price_minor,
                  court.currency,
                );
                return (
                  <Choice
                    key={court.court_id}
                    label={court.name}
                    description={[
                      t(`clubs.surfaces.${court.surface}`),
                      court.is_indoor ? t("clubs.indoor") : t("clubs.outdoor"),
                      price,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    selected={courtId === court.court_id}
                    onPress={() => setCourtId(court.court_id)}
                  />
                );
              })}
            </View>
          ) : null}

          {clubQuery.data && clubQuery.data.courts.length === 0 ? (
            <AppText style={formStyles.description}>
              {t("matches.booking.bookedOffAppNoCourts")}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <PrimaryButton
        label={t("matches.booking.bookedOffAppConfirm")}
        disabled={!canConfirm}
        loading={confirmMutation.isPending}
        onPress={handleConfirm}
      />
    </Screen>
  );
}
