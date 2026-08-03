import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getActiveZones, suggestMatchTimes } from "@tennis-lebanon/api";
import type { TimingMode } from "@tennis-lebanon/domain";
import { AppText } from "../../../src/components/AppText";
import {
  CreateMatchStepLayout,
  FigmaChipMulti,
  FigmaChipRow,
  FigmaPrimaryButton,
  figmaFormStyles,
} from "../../../src/components/onboarding-ui";
import {
  addMinutes,
  dayKey,
  nearestDuration,
  SlotPicker,
  type DurationMinutes,
  type SlotAvailability,
} from "../../../src/components/SlotPicker";
import {
  beirutLocalToUtcIso,
  utcIsoToBeirutFields,
} from "../../../src/lib/beirut-time";
import {
  createMatchStyles,
  CreateMatchPanel,
  CreateMatchSection,
} from "../../../src/lib/create-match-ui";
import {
  getCreateMatchDraft,
  updateCreateMatchDraft,
} from "../../../src/lib/create-match-draft";
import { zoneNameFromJson } from "../../../src/lib/zones";
import { ClubsDirectoryList } from "../../../src/components/ClubsDirectoryList";
import { useClubsDirectory } from "../../../src/hooks/useClubsDirectory";
import { supabase } from "../../../src/lib/supabase";

const MAX_PREFERRED_CLUBS = 3;

type SlotDraft = {
  day: string;
  startTime: string;
  duration: DurationMinutes;
};

function defaultSlot(): SlotDraft {
  return { day: dayKey(2), startTime: "18:00", duration: 90 };
}

function slotsFromDraft(): SlotDraft[] {
  const draft = getCreateMatchDraft();
  if (!draft.proposedTimes?.length) {
    return [defaultSlot()];
  }

  return draft.proposedTimes.map((slot) => {
    const { date, time } = utcIsoToBeirutFields(slot.startsAt);
    const durationMinutes = Math.max(
      1,
      Math.round(
        (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) /
          60_000,
      ),
    );

    return {
      day: date,
      startTime: time,
      duration: nearestDuration(durationMinutes),
    };
  });
}

export default function CreateMatchScheduleScreen() {
  const { t, i18n } = useTranslation();
  const draft = getCreateMatchDraft();
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>(
    draft.zoneIds ?? [],
  );
  const [timingMode, setTimingMode] = useState<TimingMode>(
    draft.timingMode ?? "fixed",
  );
  const [slots, setSlots] = useState<SlotDraft[]>(slotsFromDraft);
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>(
    draft.preferredClubIds ?? [],
  );
  const clubsRequired = draft.visibility === "public";

  const zonesQuery = useQuery({
    queryKey: ["active-zones"],
    queryFn: () => getActiveZones(supabase),
  });

  const clubsQuery = useClubsDirectory(selectedZoneIds);

  // Narrowing the areas can strand a club that is no longer on offer. Derived
  // during render rather than pruned in an effect, so the raw pick survives a
  // transient empty directory and nothing cascades a second render.
  const effectiveClubIds = useMemo(() => {
    const available = clubsQuery.data;
    if (!available) return selectedClubIds;
    return selectedClubIds.filter((id) =>
      available.some((club) => club.club_id === id),
    );
  }, [clubsQuery.data, selectedClubIds]);

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

  // Trim on the transition rather than in an effect watching `slots`, which
  // set state on every slot edit and cascaded a second render each time.
  function selectTimingMode(next: TimingMode) {
    setTimingMode(next);
    if (next === "fixed") {
      setSlots((current) => [current[0] ?? defaultSlot()]);
    }
  }

  useEffect(() => {
    const proposedTimes = slots.map((slot) => {
      const endTime = addMinutes(slot.startTime, slot.duration);
      return {
        startsAt: beirutLocalToUtcIso(slot.day, slot.startTime),
        endsAt: beirutLocalToUtcIso(slot.day, endTime),
      };
    });

    updateCreateMatchDraft({
      zoneIds: selectedZoneIds,
      preferredClubIds: effectiveClubIds,
      proposedTimes,
      timingMode,
    });
  }, [effectiveClubIds, selectedZoneIds, slots, timingMode]);

  const suggestionsQuery = useQuery({
    queryKey: ["match-time-suggestions", selectedZoneIds, draft.format],
    queryFn: () =>
      suggestMatchTimes(supabase, {
        zoneIds: selectedZoneIds,
        format: draft.format ?? null,
        limit: 40,
        slotMinutes: slots[0]?.duration ?? 90,
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

  function toggleClub(clubId: string) {
    const alreadyPicked = effectiveClubIds.includes(clubId);
    if (!alreadyPicked && effectiveClubIds.length >= MAX_PREFERRED_CLUBS) {
      return;
    }
    setSelectedClubIds((current) =>
      current.includes(clubId)
        ? current.filter((id) => id !== clubId)
        : [...current, clubId],
    );
  }

  function updateSlot(index: number, patch: Partial<SlotDraft>) {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  }

  function addSlot() {
    if (slots.length >= 3) return;
    setSlots((current) => [...current, defaultSlot()]);
  }

  function handleNext() {
    if (selectedZoneIds.length === 0) {
      Alert.alert(t("matches.create.zoneRequired"));
      return;
    }

    if (clubsRequired && effectiveClubIds.length === 0) {
      Alert.alert(t("matches.create.clubRequired"));
      return;
    }

    router.push("/match/create/review");
  }

  return (
    <CreateMatchStepLayout
      title={t("matches.create.scheduleTitle")}
      step={2}
      totalSteps={3}
      onBack={() => router.back()}
      footer={
        <FigmaPrimaryButton label={t("common.continue")} onPress={handleNext} />
      }
    >
      <View style={figmaFormStyles.stack}>
        <CreateMatchPanel title={t("matches.create.summaryWhere")}>
          <CreateMatchSection label={t("discover.zonesFilter")}>
            <FigmaChipMulti
              options={zoneOptions}
              values={selectedZoneIds}
              onToggle={toggleZone}
            />
          </CreateMatchSection>

          <CreateMatchSection
            label={t("matches.create.preferredClubsTitle")}
            description={
              clubsRequired
                ? t("matches.create.preferredClubsRequiredHelp")
                : t("matches.create.preferredClubsOptionalHelp")
            }
          >
            {selectedZoneIds.length === 0 ? (
              <AppText style={createMatchStyles.hint}>
                {t("matches.create.preferredClubsPickZoneFirst")}
              </AppText>
            ) : (
              <ClubsDirectoryList
                clubsQuery={clubsQuery}
                onClubPress={toggleClub}
                selectedClubIds={effectiveClubIds}
              />
            )}
          </CreateMatchSection>
        </CreateMatchPanel>

        <CreateMatchPanel title={t("matches.create.summaryWhen")}>
          <CreateMatchSection label={t("matches.create.timingModeTitle")}>
            <FigmaChipRow
              value={timingMode}
              options={[
                { value: "fixed", label: t("matches.create.timingFixed") },
                {
                  value: "flexible",
                  label: t("matches.create.timingFlexible"),
                },
              ]}
              onChange={selectTimingMode}
            />
          </CreateMatchSection>

          {slots.map((slot, index) => {
            const picker = (
              <SlotPicker
                selectedDay={slot.day}
                onSelectDay={(day) => updateSlot(index, { day })}
                selectedTime={slot.startTime}
                onSelectTime={(startTime) => updateSlot(index, { startTime })}
                duration={slot.duration}
                onSelectDuration={(duration) => updateSlot(index, { duration })}
                availability={availability}
              />
            );

            if (timingMode === "flexible") {
              return (
                <CreateMatchSection
                  key={`slot-${index}`}
                  label={t("matches.create.slotLabel", { index: index + 1 })}
                >
                  {picker}
                </CreateMatchSection>
              );
            }

            return <View key={`slot-${index}`}>{picker}</View>;
          })}

          {timingMode === "flexible" && slots.length < 3 ? (
            <Pressable accessibilityRole="button" onPress={addSlot}>
              <AppText style={createMatchStyles.addSlot}>
                {t("matches.create.addSlot")}
              </AppText>
            </Pressable>
          ) : null}
        </CreateMatchPanel>
      </View>
    </CreateMatchStepLayout>
  );
}
