import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  OnboardingStepLayout,
} from "../../src/components/onboarding-ui";
import { AppText } from "../../src/components/AppText";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../src/theme/tennis-tokens";

export default function CheckEmailScreen() {
  const { t } = useTranslation();

  return (
    <OnboardingStepLayout
      title={t("auth.checkEmailTitle")}
      description={t("auth.checkEmailBody")}
      onBack={() => router.replace("/(public)/sign-in")}
      footer={
        <>
          <FigmaPrimaryButton
            label={t("auth.openedLink")}
            onPress={() => router.replace("/")}
          />
          <FigmaSecondaryButton
            label={t("auth.useAnotherEmail")}
            onPress={() => router.replace("/(public)/sign-in")}
          />
        </>
      }
    >
      <View style={styles.iconBox}>
        <AppText style={styles.icon}>✉</AppText>
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
    icon: {
      fontSize: 28,
    },
    hint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 22,
      color: tennisColors.mutedForeground,
    },
  }),
);
