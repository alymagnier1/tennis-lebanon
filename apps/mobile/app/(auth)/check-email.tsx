import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  OnboardingStepLayout,
} from "../../src/components/onboarding-ui";
import { AppText } from "../../src/components/AppText";
import { Icon } from "../../src/components/Icon";
import { parseCheckEmailReason } from "../../src/lib/check-email-reason";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../src/theme/tennis-tokens";

export default function CheckEmailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason = parseCheckEmailReason(params.reason);
  const backHref =
    reason === "reset" ? "/(public)/forgot-password" : "/(public)/sign-up";

  return (
    <OnboardingStepLayout
      title={t("auth.checkEmailTitle")}
      description={
        reason === "reset"
          ? t("auth.checkEmailResetBody")
          : t("auth.checkEmailConfirmBody")
      }
      onBack={() => router.replace(backHref)}
      marks="quiet"
      footer={
        <>
          <FigmaPrimaryButton
            label={t("auth.openedLink")}
            hero
            onPress={() => router.replace("/")}
          />
          <FigmaSecondaryButton
            label={t("auth.useAnotherEmail")}
            onPress={() => router.replace(backHref)}
          />
        </>
      }
    >
      <View style={styles.iconBox}>
        <Icon name="mail" size={28} color={tennisColors.primary} />
      </View>
      <AppText style={styles.hint}>{t("auth.checkEmailHint")}</AppText>
    </OnboardingStepLayout>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    iconBox: {
      width: 56,
      height: 56,
      borderRadius: tennisRadii.md,
      backgroundColor: tennisColors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    hint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 22,
      color: tennisColors.mutedForeground,
    },
  }),
);
