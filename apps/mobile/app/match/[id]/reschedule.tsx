import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rescheduleMatchTime } from "@tennis-lebanon/api";
import {
  dayKey,
  SlotPicker,
  type DurationMinutes,
} from "../../../src/components/SlotPicker";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  FigmaSubpageHero,
} from "../../../src/components/onboarding-ui";
import { notify } from "../../../src/lib/confirm-action";
import { slotWindowUtc } from "../../../src/lib/slot-window";
import {
  goBackOrReplace,
  MATCHES_TAB_ROUTE,
} from "../../../src/lib/navigation";
import { matchHubRoute } from "../../../src/lib/routes";
import { supabase } from "../../../src/lib/supabase";
import { createLiveSheet } from "../../../src/theme/create-live-sheet";
import { tennisColors } from "../../../src/theme/tennis-tokens";

/**
 * Fixed matches agree their time up front, so renegotiation happens in chat
 * and is committed here. Blocked server-side once a court is requested.
 */
export default function RescheduleMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState(dayKey(3));
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState<DurationMinutes>(90);

  const handleBack = () =>
    goBackOrReplace(id ? matchHubRoute(id) : MATCHES_TAB_ROUTE);

  const rescheduleMutation = useMutation({
    mutationFn: () => {
      // Start plus duration, so a slot past midnight ends after it starts.
      const window = slotWindowUtc({ day, startTime, duration });
      return rescheduleMatchTime(supabase, id!, window.startsAt, window.endsAt);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["match-hub", id] });
      notify(t("matches.hub.rescheduleSuccess"));
      router.replace(matchHubRoute(id!));
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      notify(
        message.includes("match_time_locked_by_booking")
          ? t("matches.hub.rescheduleLocked")
          : t("matches.hub.rescheduleError"),
      );
    },
  });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FigmaSubpageHero
          title={t("matches.hub.rescheduleTitle")}
          description={t("matches.hub.rescheduleDescription")}
          onBack={handleBack}
        />

        <View style={styles.body}>
          <SlotPicker
            selectedDay={day}
            onSelectDay={setDay}
            selectedTime={startTime}
            onSelectTime={setStartTime}
            duration={duration}
            onSelectDuration={setDuration}
          />

          <View style={styles.actions}>
            <FigmaPrimaryButton
              label={t("matches.hub.rescheduleConfirm")}
              loading={rescheduleMutation.isPending}
              onPress={() => rescheduleMutation.mutate()}
            />
            <FigmaSecondaryButton
              label={t("common.cancel")}
              onPress={handleBack}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    body: {
      paddingHorizontal: 20,
      gap: 20,
    },
    actions: {
      gap: 10,
      paddingTop: 4,
    },
  }),
);
