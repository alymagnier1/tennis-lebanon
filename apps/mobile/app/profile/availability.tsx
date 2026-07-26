import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listOwnAvailability,
} from "@tennis-lebanon/api";
import {
  Choice,
  FormField,
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";
import {
  beirutLocalToUtcIso,
  formatUtcInBeirut,
} from "../../src/lib/beirut-time";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "../../src/lib/supabase";

type AvailabilityMode = "recurring" | "oneOff";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const [mode, setMode] = useState<AvailabilityMode>("recurring");
  const [weekday, setWeekday] = useState<number>(5);
  const [localStart, setLocalStart] = useState("18:00");
  const [localEnd, setLocalEnd] = useState("21:00");
  const [oneOffDate, setOneOffDate] = useState("");
  const [oneOffStart, setOneOffStart] = useState("18:00");
  const [oneOffEnd, setOneOffEnd] = useState("21:00");

  const availabilityQuery = useQuery({
    queryKey: ["own-availability", userId],
    queryFn: () => listOwnAvailability(supabase),
    enabled: Boolean(userId),
  });

  const invalidateDiscovery = async () => {
    await queryClient.invalidateQueries({ queryKey: ["own-availability"] });
    await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
  };

  const addWindow = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Authentication required");

      if (mode === "recurring") {
        return createAvailabilityWindow(supabase, {
          user_id: userId,
          weekday,
          local_start: localStart,
          local_end: localEnd,
          timezone: "Asia/Beirut",
          is_recurring: true,
        });
      }

      if (!oneOffDate) throw new Error("Date required");
      return createAvailabilityWindow(supabase, {
        user_id: userId,
        starts_at: beirutLocalToUtcIso(oneOffDate, oneOffStart),
        ends_at: beirutLocalToUtcIso(oneOffDate, oneOffEnd),
        timezone: "Asia/Beirut",
        is_recurring: false,
      });
    },
    onSuccess: async () => {
      await invalidateDiscovery();
      setOneOffDate("");
    },
    onError: () => Alert.alert(t("availability.saveError")),
  });

  const removeWindow = useMutation({
    mutationFn: (windowId: string) =>
      deleteAvailabilityWindow(supabase, windowId),
    onSuccess: invalidateDiscovery,
    onError: () => Alert.alert(t("availability.saveError")),
  });

  return (
    <Screen
      title={t("availability.title")}
      description={t("availability.description")}
      refreshing={availabilityQuery.isFetching}
      onRefresh={() => void availabilityQuery.refetch()}
    >
      {availabilityQuery.isLoading ? <ActivityIndicator /> : null}
      {availabilityQuery.isError ? (
        <Text style={formStyles.errorText}>{t("availability.loadError")}</Text>
      ) : null}

      {availabilityQuery.data?.length === 0 ? (
        <Text style={formStyles.description}>{t("availability.empty")}</Text>
      ) : null}

      {availabilityQuery.data?.map((window) => (
        <View key={window.id} style={formStyles.card}>
          <Text style={formStyles.summaryValue}>
            {window.is_recurring && window.weekday != null
              ? t("availability.recurringLabel", {
                  weekday: t(`availability.weekdays.${window.weekday}`),
                  start: window.local_start?.slice(0, 5),
                  end: window.local_end?.slice(0, 5),
                })
              : t("availability.oneOffLabel", {
                  start: window.starts_at
                    ? formatUtcInBeirut(window.starts_at)
                    : "",
                  end: window.ends_at ? formatUtcInBeirut(window.ends_at) : "",
                })}
          </Text>
          <SecondaryButton
            label={t("availability.remove")}
            onPress={() => removeWindow.mutate(window.id)}
          />
        </View>
      ))}

      <View style={formStyles.card}>
        <Text style={formStyles.title}>{t("availability.addWindow")}</Text>
        <View style={formStyles.segmentRow}>
          <PressableSegment
            label={t("availability.recurringTab")}
            selected={mode === "recurring"}
            onPress={() => setMode("recurring")}
          />
          <PressableSegment
            label={t("availability.oneOffTab")}
            selected={mode === "oneOff"}
            onPress={() => setMode("oneOff")}
          />
        </View>

        {mode === "recurring" ? (
          <>
            <Text style={formStyles.summaryLabel}>
              {t("availability.weekdayLabel")}
            </Text>
            {WEEKDAYS.map((value) => (
              <Choice
                key={value}
                label={t(`availability.weekdays.${value}`)}
                selected={weekday === value}
                onPress={() => setWeekday(value)}
              />
            ))}
            <FormField
              label={t("availability.startTime")}
              value={localStart}
              onChangeText={setLocalStart}
              placeholder="18:00"
              autoCapitalize="none"
            />
            <FormField
              label={t("availability.endTime")}
              value={localEnd}
              onChangeText={setLocalEnd}
              placeholder="21:00"
              autoCapitalize="none"
            />
          </>
        ) : (
          <>
            <FormField
              label={t("availability.date")}
              value={oneOffDate}
              onChangeText={setOneOffDate}
              placeholder="2026-07-25"
              autoCapitalize="none"
            />
            <FormField
              label={t("availability.startTime")}
              value={oneOffStart}
              onChangeText={setOneOffStart}
              placeholder="18:00"
              autoCapitalize="none"
            />
            <FormField
              label={t("availability.endTime")}
              value={oneOffEnd}
              onChangeText={setOneOffEnd}
              placeholder="21:00"
              autoCapitalize="none"
            />
          </>
        )}

        <PrimaryButton
          label={t("availability.addWindow")}
          loading={addWindow.isPending}
          onPress={() => addWindow.mutate()}
        />
      </View>

      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}

function PressableSegment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        formStyles.segmentButton,
        selected && formStyles.segmentButtonActive,
      ]}
    >
      <Text style={formStyles.segmentButtonText}>{label}</Text>
    </Pressable>
  );
}
