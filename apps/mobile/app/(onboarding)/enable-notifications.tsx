import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  BenefitCard,
  FigmaPrimaryButton,
  FigmaTextButton,
  OnboardingStepLayout,
} from "../../src/components/onboarding-ui";
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
    <OnboardingStepLayout
      title={t("onboarding.notifications.title")}
      description={t("onboarding.notifications.description")}
      step={5}
      totalSteps={6}
      onBack={() => router.back()}
      footer={
        <>
          <FigmaPrimaryButton
            label={t("onboarding.notifications.continue")}
            onPress={() => void enableNotifications()}
            loading={loading}
          />
          <FigmaTextButton
            label={t("onboarding.notifications.notNow")}
            onPress={continueToReview}
          />
        </>
      }
    >
      <BenefitCard
        icon="chat"
        title={t("onboarding.notifications.benefitInvites")}
        description={t("onboarding.notifications.benefitInvitesDesc")}
      />
      <BenefitCard
        icon="check"
        title={t("onboarding.notifications.benefitVotes")}
        description={t("onboarding.notifications.benefitVotesDesc")}
      />
      <BenefitCard
        icon="court"
        title={t("onboarding.notifications.benefitBooking")}
        description={t("onboarding.notifications.benefitBookingDesc")}
      />
      <BenefitCard
        icon="clock"
        title={t("onboarding.notifications.benefitReminders")}
        description={t("onboarding.notifications.benefitRemindersDesc")}
      />
    </OnboardingStepLayout>
  );
}
