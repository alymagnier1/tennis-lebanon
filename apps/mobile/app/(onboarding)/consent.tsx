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
        label={t("onboarding.consent.terms")}
        selected={draft.acceptedTerms}
        onPress={() => updateDraft({ acceptedTerms: !draft.acceptedTerms })}
      />
      <FigmaSecondaryButton
        label={t("onboarding.consent.readTerms")}
        onPress={() => router.push("/policies?document=terms")}
      />
      <PolicyToggleCard
        label={t("onboarding.consent.privacy")}
        selected={draft.acceptedPrivacy}
        onPress={() => updateDraft({ acceptedPrivacy: !draft.acceptedPrivacy })}
      />
      <FigmaSecondaryButton
        label={t("onboarding.consent.readPrivacy")}
        onPress={() => router.push("/policies?document=privacy")}
      />
      <PolicyToggleCard
        label={t("onboarding.consent.community")}
        selected={draft.acceptedCommunityRules}
        onPress={() =>
          updateDraft({
            acceptedCommunityRules: !draft.acceptedCommunityRules,
          })
        }
      />
      <FigmaSecondaryButton
        label={t("onboarding.consent.readCommunity")}
        onPress={() => router.push("/policies?document=community")}
      />
    </OnboardingStepLayout>
  );
}
