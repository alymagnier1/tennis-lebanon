import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Choice,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../src/components/FormUi";
import { useOnboarding } from "../../src/providers/OnboardingProvider";

export default function ConsentScreen() {
  const { t } = useTranslation();
  const { draft, updateDraft } = useOnboarding();
  const complete =
    draft.acceptedTerms &&
    draft.acceptedPrivacy &&
    draft.acceptedCommunityRules;

  return (
    <Screen
      title={t("onboarding.consent.title")}
      description={t("onboarding.consent.description")}
    >
      <Choice
        label={t("onboarding.consent.terms")}
        selected={draft.acceptedTerms}
        onPress={() => updateDraft({ acceptedTerms: !draft.acceptedTerms })}
      />
      <SecondaryButton
        label={t("onboarding.consent.readTerms")}
        onPress={() => router.push("/policies?document=terms")}
      />
      <Choice
        label={t("onboarding.consent.privacy")}
        selected={draft.acceptedPrivacy}
        onPress={() => updateDraft({ acceptedPrivacy: !draft.acceptedPrivacy })}
      />
      <SecondaryButton
        label={t("onboarding.consent.readPrivacy")}
        onPress={() => router.push("/policies?document=privacy")}
      />
      <Choice
        label={t("onboarding.consent.community")}
        selected={draft.acceptedCommunityRules}
        onPress={() =>
          updateDraft({
            acceptedCommunityRules: !draft.acceptedCommunityRules,
          })
        }
      />
      <SecondaryButton
        label={t("onboarding.consent.readCommunity")}
        onPress={() => router.push("/policies?document=community")}
      />
      <PrimaryButton
        label={t("common.continue")}
        disabled={!complete}
        onPress={() => router.push("/(onboarding)/identity")}
      />
    </Screen>
  );
}
