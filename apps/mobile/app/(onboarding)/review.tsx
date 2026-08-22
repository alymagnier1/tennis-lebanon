import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { completeOnboarding, setOwnGender } from "@tennis-lebanon/api";
import { POLICY_VERSIONS, onboardingInputSchema } from "@tennis-lebanon/domain";
import { ErrorNotice } from "../../src/components/FormUi";
import { AppText } from "../../src/components/AppText";
import {
  FigmaCard,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  OnboardingStepLayout,
} from "../../src/components/onboarding-ui";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { useOnboarding } from "../../src/providers/OnboardingProvider";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { StyleSheet } from "react-native";

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

      // Optional and display-only, so it is written after the profile exists
      // rather than being threaded through `complete_onboarding`. Declining to
      // say is the null case and needs no call at all.
      if (draft.gender) {
        await setOwnGender(supabase, draft.gender);
      }
    },
    onSuccess: async () => {
      await clearDraft();
      await refreshProfile();
      router.replace("/(onboarding)/complete");
    },
  });

  return (
    <OnboardingStepLayout
      title={t("onboarding.review.title")}
      description={t("onboarding.review.description")}
      step={6}
      totalSteps={6}
      onBack={() => router.back()}
      footer={
        <>
          <FigmaPrimaryButton
            label={t("onboarding.review.finish")}
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
          />
          <FigmaSecondaryButton
            label={t("common.back")}
            onPress={() => router.back()}
          />
        </>
      }
    >
      <FigmaCard style={styles.card}>
        <AppText style={styles.label}>{t("onboarding.identity.name")}</AppText>
        <AppText style={styles.value}>{draft.displayName}</AppText>
      </FigmaCard>
      <FigmaCard style={styles.card}>
        <AppText style={styles.label}>{t("onboarding.review.skill")}</AppText>
        <AppText style={styles.value}>
          {draft.skillBand ? t(`skillBands.${draft.skillBand}`) : "—"}
        </AppText>
      </FigmaCard>
      <FigmaCard style={styles.card}>
        <AppText style={styles.label}>{t("onboarding.review.zones")}</AppText>
        <AppText style={styles.value}>{draft.zoneIds.length}</AppText>
      </FigmaCard>
      {mutation.isError ? (
        <ErrorNotice>{t("onboarding.review.error")}</ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  label: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.mutedForeground,
    marginBottom: 4,
  },
  value: {
    fontFamily: tennisFontFamily.body,
    fontSize: 15,
    color: tennisColors.primaryDark,
  },
});
