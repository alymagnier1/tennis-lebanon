import { ActivityIndicator, Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listOwnAvailability,
} from "@tennis-lebanon/api";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";
import { useAuth } from "../../src/providers/AuthProvider";
import { supabase } from "../../src/lib/supabase";

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const availabilityQuery = useQuery({
    queryKey: ["own-availability", userId],
    queryFn: () => listOwnAvailability(supabase),
    enabled: Boolean(userId),
  });

  const addWindow = useMutation({
    mutationFn: (input: {
      weekday: number;
      localStart: string;
      localEnd: string;
    }) =>
      createAvailabilityWindow(supabase, {
        user_id: userId!,
        weekday: input.weekday,
        local_start: input.localStart,
        local_end: input.localEnd,
        timezone: "Asia/Beirut",
        is_recurring: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["own-availability"] });
      await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
    },
    onError: () => Alert.alert(t("availability.saveError")),
  });

  const removeWindow = useMutation({
    mutationFn: (windowId: string) =>
      deleteAvailabilityWindow(supabase, windowId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["own-availability"] });
      await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
    },
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
              : `${window.starts_at} – ${window.ends_at}`}
          </Text>
          <SecondaryButton
            label={t("availability.remove")}
            onPress={() => removeWindow.mutate(window.id)}
          />
        </View>
      ))}

      <PrimaryButton
        label={t("availability.addFriday")}
        loading={addWindow.isPending}
        onPress={() =>
          addWindow.mutate({
            weekday: 5,
            localStart: "18:00",
            localEnd: "21:00",
          })
        }
      />
      <SecondaryButton
        label={t("availability.addSaturday")}
        onPress={() =>
          addWindow.mutate({
            weekday: 6,
            localStart: "09:00",
            localEnd: "12:00",
          })
        }
      />
      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}
