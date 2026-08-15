import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getClubDetail, getMatchHub } from "@tennis-lebanon/api";
import { ClubsDirectoryList } from "../../../src/components/ClubsDirectoryList";
import { StatusBanner } from "../../../src/components/AppUi";
import { AppText } from "../../../src/components/AppText";
import { ErrorNotice, Screen } from "../../../src/components/FormUi";
import {
  FigmaBackButton,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  figmaFormStyles,
} from "../../../src/components/onboarding-ui";
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
import { CreateMatchPanel } from "../../../src/lib/create-match-ui";
import { clubIdsFromList } from "../../../src/lib/match-clubs";
import { useClubsDirectory } from "../../../src/hooks/useClubsDirectory";
import { useConfirmExternalCourt } from "../../../src/hooks/useConfirmExternalCourt";
import { matchHubRoute } from "../../../src/lib/routes";
import { confirmAction } from "../../../src/lib/confirm-action";
import { supabase } from "../../../src/lib/supabase";
import { tennisColors } from "../../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../../src/hooks/useTennisFonts";

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
  const { id, clubId } = useLocalSearchParams<{
    id: string;
    clubId?: string;
  }>();
  const { t } = useTranslation();
  // Seeded from the club card the host came from. `clubQuery` resolves the
  // court by id rather than from the directory list, so a preselected club
  // outside the match zones still confirms -- it just is not highlighted below.
  const [selectedClubId, setSelectedClubId] = useState<string | null>(
    () => clubId ?? null,
  );
  const [slot, setSlot] = useState<SlotDraft | null>(null);

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

  const clubQuery = useQuery({
    queryKey: ["club-detail", selectedClubId],
    queryFn: () => getClubDetail(supabase, selectedClubId!),
    enabled: Boolean(selectedClubId),
  });

  // Off-app booking is club-level for the host; the first listed court is a
  // stable placeholder so the RPC can record the booking without a second step.
  // Derived rather than synced through an effect: nothing else ever chooses a
  // court, so an effect only bought a second render per club change.
  const courtId =
    selectedClubId && clubQuery.data
      ? (clubQuery.data.courts[0]?.court_id ?? null)
      : null;

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

  const offPreferredList = Boolean(
    preferredClubIds.length > 0 &&
    selectedClubId &&
    !preferredClubIds.includes(selectedClubId),
  );

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

  const timeChanged = agreedSlot
    ? new Date(startsAt).getTime() !==
        new Date(agreedSlot.starts_at).getTime() ||
      new Date(endsAt).getTime() !== new Date(agreedSlot.ends_at).getTime()
    : false;

  const selectedClubHasCourts = Boolean(clubQuery.data?.courts.length);

  const confirmMutation = useConfirmExternalCourt(id!, {
    onSuccess: () => router.replace(matchHubRoute(id!)),
  });

  function handleConfirm() {
    if (!clubQuery.data || !selectedCourt) {
      return;
    }

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

    confirmAction({
      title: t("matches.booking.bookedOffAppConfirmTitle"),
      message: body,
      confirmLabel: t("matches.booking.bookedOffAppConfirm"),
      cancelLabel: t("common.cancel"),
      onConfirm: () =>
        confirmMutation.mutate({ courtId: courtId!, startsAt, endsAt }),
    });
  }

  const canConfirm = Boolean(
    selectedClubId &&
    courtId &&
    selectedClubHasCourts &&
    !confirmMutation.isPending,
  );

  if (hubQuery.isLoading) {
    return (
      <Screen title={t("matches.booking.bookedOffAppTitle")} showTitle={false}>
        <FigmaBackButton onPress={() => router.back()} />
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </Screen>
    );
  }

  if (hubQuery.data && !isHost) {
    return (
      <Screen title={t("matches.booking.bookedOffAppTitle")} showTitle={false}>
        <FigmaBackButton onPress={() => router.replace(matchHubRoute(id!))} />
        <ErrorNotice>{t("matches.booking.hostOnly")}</ErrorNotice>
        <FigmaSecondaryButton
          label={t("common.back")}
          onPress={() => router.replace(matchHubRoute(id!))}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t("matches.booking.bookedOffAppTitle")} showTitle={false}>
      <FigmaBackButton onPress={() => router.back()} />
      <AppText accessibilityRole="header" style={screenStyles.title}>
        {t("matches.booking.bookedOffAppTitle")}
      </AppText>
      <AppText style={screenStyles.description}>
        {t("matches.booking.bookedOffAppDescription")}
      </AppText>

      <View style={figmaFormStyles.stack}>
        <CreateMatchPanel title={t("matches.booking.courtTimeLabel")}>
          <AppText style={screenStyles.panelHelp}>
            {t("matches.booking.courtTimeHelp")}
          </AppText>
          <SlotPicker
            selectedDay={effectiveSlot.day}
            onSelectDay={(day) => setSlot({ ...effectiveSlot, day })}
            selectedTime={effectiveSlot.startTime}
            onSelectTime={(startTime) =>
              setSlot({ ...effectiveSlot, startTime })
            }
            duration={effectiveSlot.duration}
            onSelectDuration={(duration) =>
              setSlot({ ...effectiveSlot, duration })
            }
          />
          {agreedSlot && timeChanged ? (
            <StatusBanner
              body={t("matches.booking.timeDiffersFromAgreed", {
                agreed: formatUtcSlotInBeirut(
                  agreedSlot.starts_at,
                  agreedSlot.ends_at,
                ),
              })}
            />
          ) : null}
        </CreateMatchPanel>

        <CreateMatchPanel title={t("matches.booking.selectClub")}>
          {offPreferredList ? (
            <StatusBanner body={t("matches.booking.offPreferredListWarning")} />
          ) : null}

          <ClubsDirectoryList
            clubsQuery={clubsQuery}
            compact
            onClubPress={setSelectedClubId}
            selectedClubIds={selectedClubId ? [selectedClubId] : []}
            priorityClubIds={preferredClubIds}
          />

          {selectedClubId && clubQuery.isSuccess && !selectedClubHasCourts ? (
            <StatusBanner body={t("matches.booking.bookedOffAppNoCourts")} />
          ) : null}
        </CreateMatchPanel>

        <FigmaPrimaryButton
          label={t("matches.booking.bookedOffAppConfirm")}
          disabled={!canConfirm}
          loading={confirmMutation.isPending}
          onPress={handleConfirm}
        />
      </View>
    </Screen>
  );
}

const screenStyles = {
  title: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 24,
    lineHeight: 28,
    color: tennisColors.primaryDark,
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  description: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
    marginBottom: 20,
  },
  panelHelp: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: tennisColors.mutedForeground,
    marginBottom: 4,
  },
};
