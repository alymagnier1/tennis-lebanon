import { useState } from "react";
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
import { supabase } from "../../src/lib/supabase";
import { tennisColors, tennisRadii } from "../../src/theme/tennis-tokens";

export default function CheckEmailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason = parseCheckEmailReason(params.reason);
  const backHref =
    reason === "reset" ? "/(public)/forgot-password" : "/(public)/sign-up";
  const [checking, setChecking] = useState(false);

  /**
   * Confirming the address does not sign this device in. The tokens ride the
   * deep link, and the link is often opened in a browser, or on the phone that
   * is not running the app, so this screen can be left holding no session at
   * all. Replacing to "/" therefore re-read the same anonymous state and sent
   * the player back to Welcome, which reads as the confirmation having failed.
   *
   * If the deep link did land, the session exists and "/" routes correctly. If
   * it did not, sign-in is the honest way back: the address is confirmed now,
   * the password was chosen at sign-up, and an unconfirmed address is named
   * there by `auth.emailUnconfirmed` instead of failing silently.
   */
  const handleOpenedLink = async () => {
    setChecking(true);
    try {
      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? "/" : "/(public)/sign-in");
    } finally {
      setChecking(false);
    }
  };

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
            disabled={checking}
            onPress={() => void handleOpenedLink()}
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
