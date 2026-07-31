import { useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getActiveZones, suggestMatchTimes } from "@tennis-lebanon/api";
import { ChipMultiSelect, WizardProgress } from "../../../src/components/AppUi";
import { AppText } from "../../../src/components/AppText";
import {
  FormField,
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../../src/components/FormUi";
import {
  beirutLocalToUtcIso,
  formatUtcSlotInBeirut,
  utcIsoToBeirutFields,
} from "../../../src/lib/beirut-time";
import {
  getCreateMatchDraft,
  updateCreateMatchDraft,
} from "../../../src/lib/create-match-draft";
import { zoneNameFromJson } from "../../../src/lib/zones";
import { supabase } from "../../../src/lib/supabase";

function defaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return date.toISOString().slice(0, 10);
}

export default function CreateMatchScheduleScreen() {
  const { t, i18n } = useTranslation();
  const draft = getCreateMatchDraft();
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>(
    draft.zoneIds ?? [],
  );
  const [date, setDate] = useState(defaultDate());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:30");

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

  useEffect(() => {
    updateCreateMatchDraft({
      zoneIds: selectedZoneIds,
      proposedTimes: [
        {
          startsAt: beirutLocalToUtcIso(date, startTime),
          endsAt: beirutLocalToUtcIso(date, endTime),
        },
      ],
      // The host names one time and joining is consent to it.
      timingMode: "fixed",
    });
  }, [date, endTime, selectedZoneIds, startTime]);

  // Slots where compatible players are already free, so the host picks an
  // informed time instead of guessing into a void.
  const suggestionsQuery = useQuery({
    queryKey: ["match-time-suggestions", selectedZoneIds, draft.format],
    queryFn: () =>
      suggestMatchTimes(supabase, {
        zoneIds: selectedZoneIds,
        format: draft.format ?? null,
      }),
    enabled: selectedZoneIds.length > 0,
  });

  function applySuggestion(startsAt: string, endsAt: string) {
    const start = utcIsoToBeirutFields(startsAt);
    const end = utcIsoToBeirutFields(endsAt);
    setDate(start.date);
    setStartTime(start.time);
    setEndTime(end.time);
  }

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

        {(suggestionsQuery.data ?? []).length > 0 ? (
          <View style={formStyles.stack}>
            <AppText style={formStyles.summaryLabel}>
              {t("matches.create.suggestedTimes")}
            </AppText>
            {(suggestionsQuery.data ?? []).map((slot) => (
              <SecondaryButton
                key={slot.starts_at}
                label={t("matches.create.suggestedTimeOption", {
                  slot: formatUtcSlotInBeirut(slot.starts_at, slot.ends_at),
                  count: slot.candidate_count,
                })}
                onPress={() => applySuggestion(slot.starts_at, slot.ends_at)}
              />
            ))}
          </View>
        ) : null}

        <FormField
          label={t("availability.date")}
          value={date}
          onChangeText={setDate}
        />
        <FormField
          label={t("availability.startTime")}
          value={startTime}
          onChangeText={setStartTime}
        />
        <FormField
          label={t("availability.endTime")}
          value={endTime}
          onChangeText={setEndTime}
        />
      </View>

      <PrimaryButton label={t("common.continue")} onPress={handleNext} />
      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}
