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
import {
  addMinutes,
  dayKey,
  nearestDuration,
  SlotPicker,
  type DurationMinutes,
} from "../../../src/components/SlotPicker";
import {
  beirutLocalToUtcIso,
  formatUtcSlotInBeirut,
  utcIsoToBeirutFields,
} from "../../../src/lib/beirut-time";
import { clubIdsFromList } from "../../../src/lib/match-clubs";
import { useClubsDirectory } from "../../../src/hooks/useClubsDirectory";
import { matchHubRoute } from "../../../src/lib/routes";
import { supabase } from "../../../src/lib/supabase";

type SlotDraft = {
  day: string;
  startTime: string;
  duration: DurationMinutes;
};

type AgreedSlot = { starts_at: string; ends_at: string };

/**
 * Seeds the picker from what the group agreed, so the common case is confirm
 * and move on. The club offering a different hour is the case this screen
 * exists for, and it only needs the host to nudge the chips.
 */
function slotFromAgreed(agreed: AgreedSlot | null): SlotDraft {
  if (!agreed) {
    return { day: dayKey(1), startTime: "18:00", duration: 90 };
  }

  const { date, time } = utcIsoToBeirutFields(agreed.starts_at);
  const minutes = Math.round(
    (new Date(agreed.ends_at).getTime() -
      new Date(agreed.starts_at).getTime()) /
      60000,
  );

  return { day: date, startTime: time, duration: nearestDuration(minutes) };
}

export default function MatchBookExternalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDraft | null>(null);

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

  const preferredClubIds = useMemo(
    () => clubIdsFromList(hubQuery.data?.preferred_clubs),
    [hubQuery.data?.preferred_clubs],
  );

  // Matches created before this existed have no shortlist, and nothing is off
  // it. Warn only when the group actually agreed to a set of clubs.
  const offPreferredList = Boolean(
    preferredClubIds.length > 0 &&
    selectedClubId &&
    !preferredClubIds.includes(selectedClubId),
  );

  // Derived rather than seeded in an effect: the agreed slot arrives async, and
  // setting state from an effect cascades a second render on every load.
  const effectiveSlot = useMemo(
    () => slot ?? slotFromAgreed(agreedSlot),
    [slot, agreedSlot],
  );

  const startsAt = beirutLocalToUtcIso(
    effectiveSlot.day,
    effectiveSlot.startTime,
  );
  const endsAt = beirutLocalToUtcIso(
    effectiveSlot.day,
    addMinutes(effectiveSlot.startTime, effectiveSlot.duration),
  );

  // Compared as instants rather than strings: the agreed slot comes back from
  // Postgres in a different shape than beirutLocalToUtcIso produces.
  const timeChanged = agreedSlot
    ? new Date(startsAt).getTime() !==
        new Date(agreedSlot.starts_at).getTime() ||
      new Date(endsAt).getTime() !== new Date(agreedSlot.ends_at).getTime()
    : false;

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmExternalCourt(supabase, {
        matchId: id!,
        courtId: courtId!,
        startsAt,
        endsAt,
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
          : message.includes("Invalid court time")
            ? t("matches.booking.courtTimeInPast")
            : message.includes("Court is blocked")
              ? t("matches.booking.courtBlocked")
              : t("matches.booking.externalError"),
      );
    },
  });

  function handleSelectClub(clubId: string) {
    setSelectedClubId(clubId);
    setCourtId(null);
  }

  function handleConfirm() {
    if (!clubQuery.data || !selectedCourt) {
      return;
    }

    // A moved hour is the thing the rest of the group has to be told about, so
    // say it here rather than letting the host find out from the notice.
    const body = timeChanged
      ? t("matches.booking.bookedOffAppConfirmMovedBody", {
          club: clubQuery.data.name,
          court: selectedCourt.name,
          time: formatUtcSlotInBeirut(startsAt, endsAt),
        })
      : t("matches.booking.bookedOffAppConfirmBody", {
          club: clubQuery.data.name,
          court: selectedCourt.name,
          time: formatUtcSlotInBeirut(startsAt, endsAt),
        });

    Alert.alert(t("matches.booking.bookedOffAppConfirmTitle"), body, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("matches.booking.bookedOffAppConfirm"),
        onPress: () => confirmMutation.mutate(),
      },
    ]);
  }

  const canConfirm = Boolean(
    selectedClubId && courtId && !confirmMutation.isPending,
  );

  return (
    <Screen
      title={t("matches.booking.bookedOffAppTitle")}
      description={t("matches.booking.bookedOffAppDescription")}
    >
      {hubQuery.isLoading ? (
        <ActivityIndicator accessibilityLabel={t("discover.loading")} />
      ) : null}

      <AppText style={formStyles.summaryLabel}>
        {t("matches.booking.courtTimeLabel")}
      </AppText>
      <AppText style={formStyles.description}>
        {t("matches.booking.courtTimeHelp")}
      </AppText>

      <SlotPicker
        selectedDay={effectiveSlot.day}
        onSelectDay={(day) => setSlot({ ...effectiveSlot, day })}
        selectedTime={effectiveSlot.startTime}
        onSelectTime={(startTime) => setSlot({ ...effectiveSlot, startTime })}
        duration={effectiveSlot.duration}
        onSelectDuration={(duration) => setSlot({ ...effectiveSlot, duration })}
      />

      {agreedSlot && timeChanged ? (
        <AppText style={formStyles.errorText}>
          {t("matches.booking.timeDiffersFromAgreed", {
            agreed: formatUtcSlotInBeirut(
              agreedSlot.starts_at,
              agreedSlot.ends_at,
            ),
          })}
        </AppText>
      ) : null}

      <AppText style={formStyles.summaryLabel}>
        {t("matches.booking.selectClub")}
      </AppText>
      <ClubsDirectoryList
        clubsQuery={clubsQuery}
        onClubPress={handleSelectClub}
        priorityClubIds={preferredClubIds}
      />

      {offPreferredList ? (
        <AppText style={formStyles.errorText}>
          {t("matches.booking.offPreferredListWarning")}
        </AppText>
      ) : null}

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
