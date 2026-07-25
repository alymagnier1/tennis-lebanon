import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { completeOnboarding } from "@tennis-lebanon/api";
import { POLICY_VERSIONS, onboardingInputSchema } from "@tennis-lebanon/domain";
import {
  ErrorNotice,
  PrimaryButton,
  Screen,
  SecondaryButton,
  formStyles,
} from "../../src/components/FormUi";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { useOnboarding } from "../../src/providers/OnboardingProvider";

export default function ReviewScreen() {
  const { t } = useTranslation();
  const { draft, clearDraft } = useOnboarding();
  const { refreshProfile } = useAuth();

  const mutation = useMutation({
    mutationFn: async () => {
      const input = onboardingInputSchema.parse({
        displayName: draft.displayName,
        birthYear: Number(draft.birthYear),
        isAdultConfirmed: draft.isAdultConfirmed,
        languages: draft.languages,
        skillBand: draft.skillBand,
        playIntent: draft.playIntent,
        prefersSingles: draft.prefersSingles,
        prefersDoubles: draft.prefersDoubles,
        zoneIds: draft.zoneIds,
        termsVersion: POLICY_VERSIONS.terms,
        privacyVersion: POLICY_VERSIONS.privacy,
        communityRulesVersion: POLICY_VERSIONS.communityRules,
      });
      await completeOnboarding(supabase, input);
    },
    onSuccess: async () => {
      await clearDraft();
      await refreshProfile();
      router.replace("/");
    },
  });

  return (
    <Screen
      title={t("onboarding.review.title")}
      description={t("onboarding.review.description")}
    >
      <View style={formStyles.summary}>
        <Text style={formStyles.summaryLabel}>
          {t("onboarding.identity.name")}
        </Text>
        <Text style={formStyles.summaryValue}>{draft.displayName}</Text>
        <Text style={formStyles.summaryLabel}>
          {t("onboarding.review.skill")}
        </Text>
        <Text style={formStyles.summaryValue}>
          {draft.skillBand ? t(`skillBands.${draft.skillBand}`) : "—"}
        </Text>
        <Text style={formStyles.summaryLabel}>
          {t("onboarding.review.zones")}
        </Text>
        <Text style={formStyles.summaryValue}>{draft.zoneIds.length}</Text>
      </View>
      {mutation.isError ? (
        <ErrorNotice>{t("onboarding.review.error")}</ErrorNotice>
      ) : null}
      <PrimaryButton
        label={t("onboarding.review.finish")}
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
      />
      <SecondaryButton
        label={t("common.back")}
        onPress={() => router.back()}
        disabled={mutation.isPending}
      />
    </Screen>
  );
}
