import { useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  isAdultBirthYear,
  normalizeDisplayName,
  type SupportedLanguage,
} from "@tennis-lebanon/domain";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  ChipButton,
  FigmaPrimaryButton,
  OnboardingFormField,
  OnboardingStepLayout,
  PolicyToggleCard,
  onboardingInputStyle,
} from "../../src/components/onboarding-ui";
import { useOnboarding } from "../../src/providers/OnboardingProvider";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { AppText } from "../../src/components/AppText";
import { StyleSheet } from "react-native";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

const languages: SupportedLanguage[] = ["en", "ar", "fr"];

export default function IdentityScreen() {
  const { t } = useTranslation();
  const { draft, updateDraft } = useOnboarding();
  const [displayName, setDisplayName] = useState(draft.displayName);
  const [birthYear, setBirthYear] = useState(draft.birthYear);
  const [adultConfirmed, setAdultConfirmed] = useState(draft.isAdultConfirmed);
  const [selectedLanguages, setSelectedLanguages] = useState(draft.languages);
  const [error, setError] = useState<string | null>(null);

  const toggleLanguage = (language: SupportedLanguage) => {
    setSelectedLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language],
    );
  };

  const next = () => {
    const normalizedName = normalizeDisplayName(displayName);
    const numericYear = Number(birthYear);

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      setError(t("onboarding.identity.nameError"));
      return;
    }
    if (!isAdultBirthYear(numericYear) || !adultConfirmed) {
      setError(t("onboarding.identity.adultError"));
      return;
    }
    if (selectedLanguages.length === 0) {
      setError(t("onboarding.identity.languageError"));
      return;
    }

    updateDraft({
      displayName: normalizedName,
      birthYear,
      isAdultConfirmed: adultConfirmed,
      languages: selectedLanguages,
    });
    router.push("/(onboarding)/tennis-profile");
  };

  return (
    <OnboardingStepLayout
      title={t("onboarding.identity.title")}
      description={t("onboarding.identity.description")}
      step={2}
      totalSteps={6}
      onBack={() => router.back()}
      footer={
        <FigmaPrimaryButton label={t("common.continue")} onPress={next} />
      }
    >
      <OnboardingFormField label={t("onboarding.identity.name")}>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          textContentType="name"
          maxLength={50}
          style={onboardingInputStyle.input}
          placeholderTextColor={tennisColors.mutedForeground}
        />
      </OnboardingFormField>
      <OnboardingFormField label={t("onboarding.identity.birthYear")}>
        <TextInput
          value={birthYear}
          onChangeText={setBirthYear}
          keyboardType="number-pad"
          maxLength={4}
          style={onboardingInputStyle.input}
          placeholderTextColor={tennisColors.mutedForeground}
        />
      </OnboardingFormField>
      <PolicyToggleCard
        label={t("onboarding.identity.adultConfirm")}
        selected={adultConfirmed}
        onPress={() => setAdultConfirmed((value) => !value)}
      />
      <AppText style={styles.langLabel}>
        {t("onboarding.identity.languages")}
      </AppText>
      <View style={styles.chips}>
        {languages.map((language) => (
          <ChipButton
            key={language}
            label={t(`languages.${language}`)}
            selected={selectedLanguages.includes(language)}
            onPress={() => toggleLanguage(language)}
          />
        ))}
      </View>
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  langLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.mutedForeground,
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
});
