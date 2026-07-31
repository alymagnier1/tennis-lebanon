import { useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { submitUserReport } from "@tennis-lebanon/api";
import { REPORT_CATEGORIES, type ReportCategory } from "@tennis-lebanon/domain";
import {
  Choice,
  FormField,
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../../src/components/FormUi";
import { supabase } from "../../../src/lib/supabase";

export default function ReportPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [category, setCategory] = useState<ReportCategory>("harassment");
  const [note, setNote] = useState("");

  const submitMutation = useMutation({
    mutationFn: () =>
      submitUserReport(supabase, {
        category,
        note: note.trim() || undefined,
        reportedUserId: id!,
      }),
    onSuccess: () => {
      Alert.alert(t("reports.submitSuccess"));
      router.back();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : String(error ?? "");
      if (message.includes("report_rate_limited")) {
        Alert.alert(t("reports.rateLimited"));
        return;
      }
      Alert.alert(t("reports.submitError"));
    },
  });

  return (
    <Screen
      title={t("reports.title")}
      description={t("reports.playerDescription")}
    >
      <View style={formStyles.stack}>
        {REPORT_CATEGORIES.map((value) => (
          <Choice
            key={value}
            label={t(`reports.categories.${value}`)}
            description={t(`reports.categoryDescriptions.${value}`)}
            selected={category === value}
            onPress={() => setCategory(value)}
          />
        ))}
      </View>

      <FormField
        label={t("reports.noteLabel")}
        value={note}
        onChangeText={setNote}
        placeholder={t("reports.notePlaceholder")}
        multiline
      />

      <PrimaryButton
        label={t("reports.submit")}
        loading={submitMutation.isPending}
        onPress={() => submitMutation.mutate()}
      />
      <SecondaryButton
        label={t("common.cancel")}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
