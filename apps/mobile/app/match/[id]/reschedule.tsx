import { useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rescheduleMatchTime } from "@tennis-lebanon/api";
import {
  FormField,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../../src/components/FormUi";
import { beirutLocalToUtcIso } from "../../../src/lib/beirut-time";
import { supabase } from "../../../src/lib/supabase";

function defaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().slice(0, 10);
}

/**
 * Fixed matches agree their time up front, so renegotiation happens in chat
 * and is committed here. Blocked server-side once a court is requested.
 */
export default function RescheduleMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(defaultDate());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:30");

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      rescheduleMatchTime(
        supabase,
        id!,
        beirutLocalToUtcIso(date, startTime),
        beirutLocalToUtcIso(date, endTime),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      Alert.alert(t("matches.hub.rescheduleSuccess"));
      router.back();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      Alert.alert(
        message.includes("match_time_locked_by_booking")
          ? t("matches.hub.rescheduleLocked")
          : t("matches.hub.rescheduleError"),
      );
    },
  });

  return (
    <Screen
      title={t("matches.hub.rescheduleTitle")}
      description={t("matches.hub.rescheduleDescription")}
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
        label={t("matches.hub.rescheduleConfirm")}
        loading={rescheduleMutation.isPending}
        onPress={() => rescheduleMutation.mutate()}
      />
      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}
