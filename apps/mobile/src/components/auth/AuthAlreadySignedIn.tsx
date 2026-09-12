import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorNotice } from "../FormUi";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  OnboardingStepLayout,
} from "../onboarding-ui";
import { useAuth } from "../../providers/AuthProvider";

export function AuthAlreadySignedIn() {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState(false);
  const email = session?.user.email ?? "";

  const switchAccount = async () => {
    setSignOutError(false);
    try {
      await signOut();
    } catch {
      setSignOutError(true);
    }
  };

  return (
    <OnboardingStepLayout
      title={t("auth.alreadySignedInTitle")}
      description={t("auth.alreadySignedInBody", { email })}
      onBack={() => router.replace("/(onboarding)/consent")}
      scroll={false}
      footer={
        <>
          <FigmaPrimaryButton
            label={t("auth.continueOnboarding")}
            onPress={() => router.replace("/(onboarding)/consent")}
          />
          <FigmaSecondaryButton
            label={t("auth.useAnotherEmail")}
            onPress={() => void switchAccount()}
          />
        </>
      }
    >
      {signOutError ? (
        <ErrorNotice>{t("auth.signOutError")}</ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}
