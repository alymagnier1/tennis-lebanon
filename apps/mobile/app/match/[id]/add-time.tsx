import { useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMatchTimeOption } from "@tennis-lebanon/api";
import {
  addMinutes,
  dayKey,
  SlotPicker,
  type DurationMinutes,
} from "../../../src/components/SlotPicker";
import { PrimaryButton, Screen } from "../../../src/components/FormUi";
import { beirutLocalToUtcIso } from "../../../src/lib/beirut-time";
import { supabase } from "../../../src/lib/supabase";

export default function AddMatchTimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(dayKey(3));
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState<DurationMinutes>(90);

  const addMutation = useMutation({
    mutationFn: () =>
      addMatchTimeOption(
        supabase,
        id!,
        beirutLocalToUtcIso(day, startTime),
        beirutLocalToUtcIso(day, addMinutes(startTime, duration)),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      Alert.alert(t("matches.hub.addTimeSuccess"));
      router.back();
    },
    onError: () => Alert.alert(t("matches.hub.addTimeError")),
  });

  return (
    <Screen
      title={t("matches.hub.addTimeTitle")}
      description={t("matches.hub.addTimeDescription")}
    >
      <SlotPicker
        selectedDay={day}
        onSelectDay={setDay}
        selectedTime={startTime}
        onSelectTime={setStartTime}
        duration={duration}
        onSelectDuration={setDuration}
      />

      <PrimaryButton
        label={t("matches.hub.addTime")}
        loading={addMutation.isPending}
        onPress={() => addMutation.mutate()}
      />
    </Screen>
  );
}
