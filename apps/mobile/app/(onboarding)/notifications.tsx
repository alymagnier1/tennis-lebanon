import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../src/components/FormUi";
import { syncDevicePushToken } from "../../src/lib/push-notifications";

export default function NotificationPrimerScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const continueToReview = () => router.push("/(onboarding)/review");

  const enableNotifications = async () => {
    setLoading(true);
    try {
      await syncDevicePushToken({ requestPermission: true });
    } finally {
      setLoading(false);
      continueToReview();
    }
  };

  return (
    <Screen
      title={t("onboarding.notifications.title")}
      description={t("onboarding.notifications.description")}
    >
      <PrimaryButton
        label={t("onboarding.notifications.continue")}
        onPress={() => void enableNotifications()}
        loading={loading}
      />
      <SecondaryButton
        label={t("onboarding.notifications.notNow")}
        onPress={continueToReview}
      />
    </Screen>
  );
}
