import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LOCALES,
  getTextDirection,
  type SupportedLocale,
} from "@tennis-lebanon/i18n";
import { AppText } from "../src/components/AppText";
import {
  FigmaCard,
  FigmaChipRow,
  OnboardingStepLayout,
} from "../src/components/onboarding-ui";
import { createLiveSheet } from "../src/theme/create-live-sheet";
import { tennisFontFamily } from "../src/hooks/useTennisFonts";
import { tennisColors } from "../src/theme/tennis-tokens";

/**
 * Milestone 0 visual RTL check. Switches locale/text-direction on this
 * screen only (does not call native I18nManager.forceRTL, which requires
 * an app reload) so Arabic layout can be reviewed without restarting.
 * Full native RTL mirroring is a follow-up item, not required for M0.
 */
export default function RtlCheckScreen() {
  const { t, i18n } = useTranslation();
  const [locale, setLocale] = useState<SupportedLocale>(
    i18n.language as SupportedLocale,
  );

  const direction = getTextDirection(locale);
  const isRtl = direction === "rtl";

  const selectLocale = (next: SupportedLocale) => {
    setLocale(next);
    void i18n.changeLanguage(next);
  };

  const localeOptions = SUPPORTED_LOCALES.map((code) => ({
    value: code,
    label: code.toUpperCase(),
  }));

  return (
    <OnboardingStepLayout
      title={t("rtlCheck.title")}
      description={t("rtlCheck.switchLanguage")}
      onBack={() => router.back()}
    >
      <View style={styles.stack}>
        <FigmaChipRow
          options={localeOptions}
          value={locale}
          onChange={selectLocale}
        />

        <FigmaCard style={[styles.card, isRtl && styles.cardRtl]}>
          <AppText
            style={[styles.description, { writingDirection: direction }]}
            accessibilityLanguage={locale}
          >
            {t("rtlCheck.description")}
          </AppText>
          <AppText
            style={[styles.sample, { writingDirection: direction }]}
            accessibilityLanguage={locale}
          >
            {t("rtlCheck.sampleSentence")}
          </AppText>
          <AppText style={styles.meta}>
            {t("rtlCheck.directionLabel")}: {direction}
          </AppText>
        </FigmaCard>
      </View>
    </OnboardingStepLayout>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    stack: {
      gap: 20,
    },
    card: {
      gap: 12,
    },
    cardRtl: {
      alignItems: "flex-end",
    },
    description: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
      textAlign: "auto",
    },
    sample: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 16,
      lineHeight: 22,
      color: tennisColors.primaryDark,
      textAlign: "auto",
    },
    meta: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
  }),
);
