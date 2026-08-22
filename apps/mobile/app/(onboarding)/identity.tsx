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
  OnboardingYearField,
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
const genders: Gender[] = ["female", "male"];

/**
 * Only the year is collected, and the field says so.
 *
 * `profiles.birth_year` is a `smallint` and the only thing the product asks of
 * it is adult eligibility, so a full date of birth would be more personal data
 * than anything downstream uses. The list starts at the youngest year that can
 * join, which makes the rule visible instead of enforcing it after submission.
 */
const currentYear = new Date().getUTCFullYear();
const youngestEligibleYear = currentYear - 18;
const oldestOfferedYear = currentYear - 90;

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
  const hasYear = birthYear.length === 4 && Number.isInteger(numericYear);

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

    // The list cannot offer an ineligible year, so the only failures left are
    // choosing nothing and not ticking the attestation.
    if (!hasYear || !isAdultBirthYear(numericYear, currentYear)) {
      nextErrors.birthYear = t("onboarding.identity.birthYearError");
    } else if (!adultConfirmed) {
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

  const photoLabel = profile?.avatar_path
    ? t("onboarding.identity.photoChange")
    : t("onboarding.identity.photoAdd");

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
      {/* The avatar leads: it anchors the page and stops the step reading as an
          undifferentiated stack of inputs. Optional, and labelled as such. */}
      <View style={styles.photoBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoLabel}
          disabled={avatarMutation.isPending}
          onPress={() => avatarMutation.mutate()}
          style={({ pressed }) => [
            styles.photoTarget,
            pressed && styles.photoTargetPressed,
          ]}
        >
          <Avatar
            name={displayName}
            avatarPath={profile?.avatar_path}
            size={92}
          />
          <AppText style={styles.photoAction}>{photoLabel}</AppText>
        </Pressable>
        <AppText style={[tennisTextStyles.fieldHint, styles.photoHint]}>
          {t("onboarding.identity.photoHint")}
        </AppText>
        {photoError ? <ErrorNotice>{photoError}</ErrorNotice> : null}
      </View>

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
        <OnboardingYearField
          value={birthYear}
          onChange={(year) => {
            setBirthYear(year);
            setErrors((current) => ({ ...current, birthYear: undefined }));
          }}
          minYear={oldestOfferedYear}
          maxYear={youngestEligibleYear}
          label={t("onboarding.identity.birthYear")}
          placeholder={t("onboarding.identity.birthYearPlaceholder")}
        />
        <AppText style={[tennisTextStyles.fieldHint, styles.fieldHint]}>
          {hasYear
            ? t("onboarding.identity.birthYearAge", {
                age: currentYear - numericYear,
              })
            : t("onboarding.identity.birthYearHint")}
        </AppText>
      </OnboardingFormField>

      <OnboardingFormField label={t("onboarding.identity.gender")}>
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
      </OnboardingFormField>

      <OnboardingFormField
        label={t("onboarding.identity.languages")}
        error={errors.languages}
      >
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
      </OnboardingFormField>

      {/* Last, next to the commitment it is: an attestation rather than another
          detail about you. */}
      <PolicyToggleCard
        label={t("onboarding.identity.adultConfirm")}
        selected={adultConfirmed}
        onPress={() => {
          setAdultConfirmed((value) => !value);
          setErrors((current) => ({ ...current, birthYear: undefined }));
        }}
      />
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  photoBlock: {
    alignItems: "center",
    marginBottom: 28,
  },
  photoTarget: {
    alignItems: "center",
    gap: 10,
  },
  photoTargetPressed: {
    opacity: 0.7,
  },
  photoAction: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 15,
    color: tennisColors.primary,
  },
  photoHint: {
    marginTop: 8,
    textAlign: "center",
  },
  fieldHint: {
    marginTop: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
