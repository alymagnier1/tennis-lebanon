import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  FigmaPrimaryButton,
  OnboardingStepLayout,
  PolicyDocumentList,
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
      totalSteps={3}
      onBack={leaveOnboarding}
      backAccessibilityLabel={t("onboarding.consent.leave")}
      footer={
        <FigmaPrimaryButton
          label={t("common.continue")}
          disabled={!complete}
          onPress={() => router.push("/(onboarding)/identity")}
        />
      }
    >
      <PolicyDocumentList
        items={[
          {
            key: "terms",
            label: t("onboarding.consent.documentTerms"),
            onPress: () => router.push("/policies?document=terms"),
          },
          {
            key: "privacy",
            label: t("onboarding.consent.documentPrivacy"),
            onPress: () => router.push("/policies?document=privacy"),
          },
          {
            key: "community",
            label: t("onboarding.consent.documentCommunity"),
            onPress: () => router.push("/policies?document=community"),
          },
        ]}
      />
      <PolicyToggleCard
        label={t("onboarding.consent.acceptAll")}
        selected={complete}
        onPress={toggleAll}
      />
    </OnboardingStepLayout>
  );
}
