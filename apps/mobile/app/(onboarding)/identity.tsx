import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  isAdultBirthYear,
  normalizeDisplayName,
  type SupportedLanguage,
} from "@tennis-lebanon/domain";
import {
  Choice,
  ErrorNotice,
  FormField,
  PrimaryButton,
  Screen,
} from "../../src/components/FormUi";
import { useOnboarding } from "../../src/providers/OnboardingProvider";

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
    <Screen
      title={t("onboarding.identity.title")}
      description={t("onboarding.identity.description")}
    >
      <FormField
        label={t("onboarding.identity.name")}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        textContentType="name"
        maxLength={50}
      />
      <FormField
        label={t("onboarding.identity.birthYear")}
        value={birthYear}
        onChangeText={setBirthYear}
        keyboardType="number-pad"
        maxLength={4}
      />
      <Choice
        label={t("onboarding.identity.adultConfirm")}
        selected={adultConfirmed}
        onPress={() => setAdultConfirmed((value) => !value)}
      />
      {languages.map((language) => (
        <Choice
          key={language}
          label={t(`languages.${language}`)}
          selected={selectedLanguages.includes(language)}
          onPress={() => toggleLanguage(language)}
        />
      ))}
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}
      <PrimaryButton label={t("common.continue")} onPress={next} />
    </Screen>
  );
}
