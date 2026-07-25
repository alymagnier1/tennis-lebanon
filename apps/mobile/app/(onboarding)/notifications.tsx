import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../src/components/FormUi";

export default function NotificationPrimerScreen() {
  const { t } = useTranslation();

  const continueToReview = () => router.push("/(onboarding)/review");

  return (
    <Screen
      title={t("onboarding.notifications.title")}
      description={t("onboarding.notifications.description")}
    >
      <PrimaryButton
        label={t("onboarding.notifications.continue")}
        onPress={continueToReview}
      />
      <SecondaryButton
        label={t("onboarding.notifications.notNow")}
        onPress={continueToReview}
      />
    </Screen>
  );
}
