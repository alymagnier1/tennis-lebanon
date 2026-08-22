import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
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
import { tennisTextStyles } from "../../src/theme/tennis-text-styles";
import { AppText } from "../../src/components/AppText";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

const languages: SupportedLanguage[] = ["en", "ar", "fr"];

/**
 * Only the year is collected, and the field says so.
 *
 * `profiles.birth_year` is a `smallint` and the only thing the product asks of
 * it is adult eligibility, so a full date of birth would be more personal data
 * than anything downstream uses. The field used to be a bare four-digit box
 * with no placeholder and no feedback, which read as unfinished rather than
 * deliberate; the hint and the echoed age below make the narrower ask look like
 * the choice it is.
 */
const currentYear = new Date().getUTCFullYear();
const earliestYear = 1900;

type FieldErrors = {
  displayName?: string;
  birthYear?: string;
  languages?: string;
};

export default function IdentityScreen() {
  const { t } = useTranslation();
  const { draft, updateDraft } = useOnboarding();
  const [displayName, setDisplayName] = useState(draft.displayName);
  const [birthYear, setBirthYear] = useState(draft.birthYear);
  const [adultConfirmed, setAdultConfirmed] = useState(draft.isAdultConfirmed);
  const [selectedLanguages, setSelectedLanguages] = useState(draft.languages);
  const [errors, setErrors] = useState<FieldErrors>({});

  const numericYear = Number(birthYear);
  const yearLooksComplete =
    birthYear.length === 4 &&
    Number.isInteger(numericYear) &&
    numericYear >= earliestYear &&
    numericYear <= currentYear;

  const toggleLanguage = (language: SupportedLanguage) => {
    setErrors((current) => ({ ...current, languages: undefined }));
    setSelectedLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language],
    );
  };

  const next = () => {
    const normalizedName = normalizeDisplayName(displayName);
    const nextErrors: FieldErrors = {};

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      nextErrors.displayName = t("onboarding.identity.nameError");
    }

    // Two failures worth telling apart: a year that is not a year, and a year
    // that is a year but too recent to join. The screen used to report both as
    // "you must be 18 or older", which is confusing after a typo.
    if (!yearLooksComplete) {
      nextErrors.birthYear = t("onboarding.identity.birthYearError");
    } else if (!isAdultBirthYear(numericYear, currentYear) || !adultConfirmed) {
      nextErrors.birthYear = t("onboarding.identity.adultError");
    }

    if (selectedLanguages.length === 0) {
      nextErrors.languages = t("onboarding.identity.languageError");
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
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
      <OnboardingFormField
        label={t("onboarding.identity.name")}
        error={errors.displayName}
      >
        <TextInput
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(value);
            setErrors((current) => ({ ...current, displayName: undefined }));
          }}
          autoCapitalize="words"
          textContentType="name"
          maxLength={50}
          style={onboardingInputStyle.input}
          placeholderTextColor={tennisColors.mutedForeground}
        />
      </OnboardingFormField>

      <OnboardingFormField
        label={t("onboarding.identity.birthYear")}
        error={errors.birthYear}
      >
        <TextInput
          value={birthYear}
          onChangeText={(value) => {
            // Strip anything that is not a digit so a stray character cannot
            // silently make the year unparseable.
            setBirthYear(value.replace(/[^0-9]/g, "").slice(0, 4));
            setErrors((current) => ({ ...current, birthYear: undefined }));
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          placeholder={String(currentYear - 30)}
          accessibilityLabel={t("onboarding.identity.birthYear")}
          style={onboardingInputStyle.input}
          placeholderTextColor={tennisColors.mutedForeground}
        />
        <AppText style={[tennisTextStyles.fieldHint, styles.hint]}>
          {yearLooksComplete
            ? t("onboarding.identity.birthYearAge", {
                age: currentYear - numericYear,
              })
            : t("onboarding.identity.birthYearHint")}
        </AppText>
      </OnboardingFormField>

      <PolicyToggleCard
        label={t("onboarding.identity.adultConfirm")}
        selected={adultConfirmed}
        onPress={() => {
          setAdultConfirmed((value) => !value);
          setErrors((current) => ({ ...current, birthYear: undefined }));
        }}
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
      {errors.languages ? <ErrorNotice>{errors.languages}</ErrorNotice> : null}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginTop: 6,
  },
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
