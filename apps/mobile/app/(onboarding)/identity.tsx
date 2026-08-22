import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  isAdultBirthYear,
  normalizeDisplayName,
  type Gender,
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
import { Avatar } from "../../src/components/AppUi";
import { pickAndUploadOwnAvatar } from "../../src/lib/pick-own-avatar";
import { useAuth } from "../../src/providers/AuthProvider";
import { useOnboarding } from "../../src/providers/OnboardingProvider";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { tennisTextStyles } from "../../src/theme/tennis-text-styles";
import { AppText } from "../../src/components/AppText";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";

const languages: SupportedLanguage[] = ["en", "ar", "fr"];
const genders: Gender[] = ["woman", "man", "other"];

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
  const { profile, refreshProfile } = useAuth();
  const { draft, updateDraft } = useOnboarding();
  const [displayName, setDisplayName] = useState(draft.displayName);
  const [birthYear, setBirthYear] = useState(draft.birthYear);
  const [adultConfirmed, setAdultConfirmed] = useState(draft.isAdultConfirmed);
  const [selectedLanguages, setSelectedLanguages] = useState(draft.languages);
  const [gender, setGender] = useState<Gender | null>(draft.gender);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState<string | null>(null);

  // The profile row exists from signup (trigger in 002), and `set_own_avatar`
  // no longer demands a completed onboarding, so the upload can happen right
  // here rather than being held in memory until the end.
  const avatarMutation = useMutation({
    mutationFn: pickAndUploadOwnAvatar,
    onSuccess: async (result) => {
      if (result.status === "success") {
        setPhotoError(null);
        await refreshProfile();
        return;
      }

      if (result.status === "permission_denied") {
        setPhotoError(t("profile.avatarPermissionDenied"));
      }
    },
    onError: () => setPhotoError(t("profile.avatarUploadError")),
  });

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
      gender,
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

      <AppText style={styles.langLabel}>
        {t("onboarding.identity.photo")}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          profile?.avatar_path
            ? t("onboarding.identity.photoChange")
            : t("onboarding.identity.photoAdd")
        }
        disabled={avatarMutation.isPending}
        onPress={() => avatarMutation.mutate()}
        style={({ pressed }) => [
          styles.photoRow,
          pressed && styles.photoRowPressed,
        ]}
      >
        <Avatar
          name={displayName}
          avatarPath={profile?.avatar_path}
          size={64}
        />
        <AppText style={styles.photoAction}>
          {profile?.avatar_path
            ? t("onboarding.identity.photoChange")
            : t("onboarding.identity.photoAdd")}
        </AppText>
      </Pressable>
      <AppText style={[tennisTextStyles.fieldHint, styles.photoHint]}>
        {t("onboarding.identity.photoHint")}
      </AppText>
      {photoError ? <ErrorNotice>{photoError}</ErrorNotice> : null}

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

      <AppText style={styles.langLabel}>
        {t("onboarding.identity.gender")}
      </AppText>
      <View style={styles.chips}>
        {genders.map((option) => (
          <ChipButton
            key={option}
            label={t(`gender.${option}`)}
            selected={gender === option}
            // Tapping the chosen chip clears it. Not stating a gender is a
            // valid answer, so it has to stay reachable after answering.
            onPress={() =>
              setGender((current) => (current === option ? null : option))
            }
          />
        ))}
      </View>

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
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 6,
  },
  photoRowPressed: {
    opacity: 0.7,
  },
  photoAction: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 15,
    color: tennisColors.primary,
  },
  photoHint: {
    marginBottom: 16,
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
