import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMatchTimeOption } from "@tennis-lebanon/api";
import {
  FormField,
  PrimaryButton,
  Screen,
  formStyles,
} from "../../../src/components/FormUi";
import { beirutLocalToUtcIso } from "../../../src/lib/beirut-time";
import { supabase } from "../../../src/lib/supabase";

function defaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().slice(0, 10);
}

export default function AddMatchTimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(defaultDate());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:30");

  const addMutation = useMutation({
    mutationFn: () =>
      addMatchTimeOption(
        supabase,
        id!,
        beirutLocalToUtcIso(date, startTime),
        beirutLocalToUtcIso(date, endTime),
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

      <PrimaryButton
        label={t("matches.hub.addTime")}
        loading={addMutation.isPending}
        onPress={() => addMutation.mutate()}
      />
    </Screen>
  );
}
