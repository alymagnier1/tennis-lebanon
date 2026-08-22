import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  OnboardingStepLayout,
  PolicyToggleCard,
} from "../../src/components/onboarding-ui";
import { useAuth } from "../../src/providers/AuthProvider";
import { useOnboarding } from "../../src/providers/OnboardingProvider";

export default function ConsentScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { draft, updateDraft } = useOnboarding();
  const complete =
    draft.acceptedTerms &&
    draft.acceptedPrivacy &&
    draft.acceptedCommunityRules;

  // One affirmative act covering all three documents. Each stays separately
  // readable and is still stored as its own flag, so nothing downstream changes
  // -- this only stops the funnel asking for three taps at its highest
  // drop-off point.
  const toggleAll = () => {
    const next = !complete;
    updateDraft({
      acceptedTerms: next,
      acceptedPrivacy: next,
      acceptedCommunityRules: next,
    });
  };

  const leaveOnboarding = () => {
    void (async () => {
      await signOut().catch(() => undefined);
      router.replace("/(public)/welcome");
    })();
  };

  return (
    <OnboardingStepLayout
      title={t("onboarding.consent.title")}
      description={t("onboarding.consent.description")}
      step={1}
      totalSteps={6}
      onBack={leaveOnboarding}
      footer={
        <FigmaPrimaryButton
          label={t("common.continue")}
          disabled={!complete}
          onPress={() => router.push("/(onboarding)/identity")}
        />
      }
    >
      <PolicyToggleCard
        label={t("onboarding.consent.acceptAll")}
        selected={complete}
        onPress={toggleAll}
      />
      <FigmaSecondaryButton
        label={t("onboarding.consent.readTerms")}
        onPress={() => router.push("/policies?document=terms")}
      />
      <FigmaSecondaryButton
        label={t("onboarding.consent.readPrivacy")}
        onPress={() => router.push("/policies?document=privacy")}
      />
      <FigmaSecondaryButton
        label={t("onboarding.consent.readCommunity")}
        onPress={() => router.push("/policies?document=community")}
      />
    </OnboardingStepLayout>
  );
}
