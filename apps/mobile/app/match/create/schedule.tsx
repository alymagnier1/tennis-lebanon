import { useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getActiveZones, suggestMatchTimes } from "@tennis-lebanon/api";
import { ChipMultiSelect, WizardProgress } from "../../../src/components/AppUi";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../../src/components/FormUi";
import {
  addMinutes,
  dayKey,
  SlotPicker,
  type DurationMinutes,
  type SlotAvailability,
} from "../../../src/components/SlotPicker";
import {
  beirutLocalToUtcIso,
  utcIsoToBeirutFields,
} from "../../../src/lib/beirut-time";
import {
  getCreateMatchDraft,
  updateCreateMatchDraft,
} from "../../../src/lib/create-match-draft";
import { zoneNameFromJson } from "../../../src/lib/zones";
import { supabase } from "../../../src/lib/supabase";

export default function CreateMatchScheduleScreen() {
  const { t, i18n } = useTranslation();
  const draft = getCreateMatchDraft();
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>(
    draft.zoneIds ?? [],
  );
  const [day, setDay] = useState(() => dayKey(2));
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState<DurationMinutes>(90);

  const zonesQuery = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const zoneOptions = useMemo(
    () =>
      (zonesQuery.data ?? []).map((zone) => ({
        value: zone.id,
        label: zoneNameFromJson(
          zone.name_i18n,
          i18n.resolvedLanguage ?? i18n.language,
        ),
      })),
    [i18n.language, i18n.resolvedLanguage, zonesQuery.data],
  );

  useEffect(() => {
    if (!draft.format) {
      router.replace("/match/create/details");
    }
  }, [draft.format]);

  const endTime = addMinutes(startTime, duration);

  useEffect(() => {
    updateCreateMatchDraft({
      zoneIds: selectedZoneIds,
      proposedTimes: [
        {
          startsAt: beirutLocalToUtcIso(day, startTime),
          endsAt: beirutLocalToUtcIso(day, endTime),
        },
      ],
      // The host names one time and joining is consent to it.
      timingMode: "fixed",
    });
  }, [day, endTime, selectedZoneIds, startTime]);

  // Turns the suggestion RPC into a lookup the picker can render against each
  // slot, so the host can see where a match is actually likely to fill.
  const suggestionsQuery = useQuery({
    queryKey: ["match-time-suggestions", selectedZoneIds, draft.format],
    queryFn: () =>
      suggestMatchTimes(supabase, {
        zoneIds: selectedZoneIds,
        format: draft.format ?? null,
        limit: 40,
        slotMinutes: duration,
      }),
    enabled: selectedZoneIds.length > 0,
  });

  const availability = useMemo<SlotAvailability>(() => {
    const map: SlotAvailability = {};
    for (const slot of suggestionsQuery.data ?? []) {
      if (slot.candidate_count <= 0) continue;
      const { date, time } = utcIsoToBeirutFields(slot.starts_at);
      map[`${date} ${time}`] = slot.candidate_count;
    }
    return map;
  }, [suggestionsQuery.data]);

  function toggleZone(zoneId: string) {
    setSelectedZoneIds((current) =>
      current.includes(zoneId)
        ? current.filter((id) => id !== zoneId)
        : [...current, zoneId],
    );
  }

  function handleNext() {
    if (selectedZoneIds.length === 0) {
      Alert.alert(t("matches.create.zoneRequired"));
      return;
    }

    router.push("/match/create/review");
  }

  return (
    <Screen
      title={t("matches.create.scheduleTitle")}
      showTitle={false}
      description={t("matches.create.scheduleDescription")}
    >
      <WizardProgress step={2} totalSteps={3} />

      <View style={formStyles.stack}>
        <ChipMultiSelect
          label={t("discover.zonesFilter")}
          options={zoneOptions}
          values={selectedZoneIds}
          onToggle={toggleZone}
        />

        <SlotPicker
          selectedDay={day}
          onSelectDay={setDay}
          selectedTime={startTime}
          onSelectTime={setStartTime}
          duration={duration}
          onSelectDuration={setDuration}
          availability={availability}
        />
      </View>

      <PrimaryButton label={t("common.continue")} onPress={handleNext} />
      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}
