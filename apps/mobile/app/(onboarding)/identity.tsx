import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  isAdultBirthYear,
  normalizeDisplayName,
  type Gender,
  type PlayIntent,
  type SkillBand,
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
  SelectionCard,
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
const bands: SkillBand[] = [
  "beginner",
  "improving",
  "intermediate",
  "advanced",
  "competitive",
];
const intents: PlayIntent[] = ["social", "competitive", "either"];

const currentYear = new Date().getUTCFullYear();
const youngestEligibleYear = currentYear - 18;
const oldestOfferedYear = currentYear - 90;

type FieldErrors = {
  displayName?: string;
  birthYear?: string;
  languages?: string;
  skillBand?: string;
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
  const [skillBand, setSkillBand] = useState(draft.skillBand);
  const [playIntent, setPlayIntent] = useState(draft.playIntent);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState<string | null>(null);

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

    if (!hasYear || !isAdultBirthYear(numericYear, currentYear)) {
      nextErrors.birthYear = t("onboarding.identity.birthYearError");
    } else if (!adultConfirmed) {
      nextErrors.birthYear = t("onboarding.identity.adultError");
    }

    if (selectedLanguages.length === 0) {
      nextErrors.languages = t("onboarding.identity.languageError");
    }

    if (!skillBand) {
      nextErrors.skillBand = t("onboarding.tennis.skillError");
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
      skillBand,
      playIntent,
      prefersSingles: true,
      prefersDoubles: true,
    });
    router.push("/(onboarding)/zones");
  };

  const photoLabel = profile?.avatar_path
    ? t("onboarding.identity.photoChange")
    : t("onboarding.identity.photoAdd");

  return (
    <OnboardingStepLayout
      title={t("onboarding.identity.title")}
      description={t("onboarding.identity.description")}
      step={2}
      totalSteps={3}
      onBack={() => router.back()}
      footer={
        <FigmaPrimaryButton label={t("common.continue")} onPress={next} />
      }
    >
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

      <PolicyToggleCard
        label={t("onboarding.identity.adultConfirm")}
        selected={adultConfirmed}
        onPress={() => {
          setAdultConfirmed((value) => !value);
          setErrors((current) => ({ ...current, birthYear: undefined }));
        }}
      />

      <AppText style={styles.section}>{t("onboarding.tennis.title")}</AppText>
      <AppText style={styles.sectionHint}>
        {t("onboarding.tennis.description")}
      </AppText>
      {errors.skillBand ? <ErrorNotice>{errors.skillBand}</ErrorNotice> : null}
      {bands.map((band) => (
        <SelectionCard
          key={band}
          label={t(`onboarding.tennis.bands.${band}`)}
          description={t(`skillBands.${band}`)}
          selected={skillBand === band}
          onPress={() => {
            setSkillBand(band);
            setErrors((current) => ({ ...current, skillBand: undefined }));
          }}
        />
      ))}
      {skillBand ? (
        <AppText style={styles.commitmentEcho}>
          {t("onboarding.tennis.commitmentEcho", {
            band: t(`skillBands.${skillBand}`),
          })}
        </AppText>
      ) : null}
      <AppText style={styles.section}>
        {t("onboarding.tennis.provisional")}
      </AppText>
      <View style={styles.chips}>
        {intents.map((intent) => (
          <ChipButton
            key={intent}
            label={t(`playIntent.${intent}`)}
            selected={playIntent === intent}
            onPress={() => setPlayIntent(intent)}
          />
        ))}
      </View>
    </OnboardingStepLayout>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
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
    section: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 16,
      color: tennisColors.primaryDark,
      marginBottom: 8,
      marginTop: 16,
    },
    sectionHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
      marginBottom: 12,
    },
    commitmentEcho: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      lineHeight: 20,
      color: tennisColors.primaryDark,
      marginTop: 8,
      marginBottom: 4,
    },
  }),
);
