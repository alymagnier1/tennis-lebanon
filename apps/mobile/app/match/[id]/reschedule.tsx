import { useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rescheduleMatchTime } from "@tennis-lebanon/api";
import {
  addMinutes,
  dayKey,
  SlotPicker,
  type DurationMinutes,
} from "../../../src/components/SlotPicker";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../../src/components/FormUi";
import { beirutLocalToUtcIso } from "../../../src/lib/beirut-time";
import { supabase } from "../../../src/lib/supabase";

/**
 * Fixed matches agree their time up front, so renegotiation happens in chat
 * and is committed here. Blocked server-side once a court is requested.
 */
export default function RescheduleMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(dayKey(3));
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState<DurationMinutes>(90);

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      rescheduleMatchTime(
        supabase,
        id!,
        beirutLocalToUtcIso(day, startTime),
        beirutLocalToUtcIso(day, addMinutes(startTime, duration)),
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
      <SlotPicker
        selectedDay={day}
        onSelectDay={setDay}
        selectedTime={startTime}
        onSelectTime={setStartTime}
        duration={duration}
        onSelectDuration={setDuration}
      />

      <PrimaryButton
        label={t("matches.hub.rescheduleConfirm")}
        loading={rescheduleMutation.isPending}
        onPress={() => rescheduleMutation.mutate()}
      />
      <SecondaryButton
        label={t("common.cancel")}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
