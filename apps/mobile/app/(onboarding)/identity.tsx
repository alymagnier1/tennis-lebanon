import { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ScrollView,
} from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
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
import {
  validateOnboardingIdentity,
  type OnboardingIdentityField,
} from "../../src/lib/onboarding-identity-validation";
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

type FieldErrors = Partial<Record<OnboardingIdentityField, string>>;

function fieldErrorMessage(
  field: OnboardingIdentityField,
  t: (key: string) => string,
): string {
  switch (field) {
    case "displayName":
      return t("onboarding.identity.nameError");
    case "birthYear":
      return t("onboarding.identity.birthYearError");
    case "adultConfirm":
      return t("onboarding.identity.adultError");
    case "languages":
      return t("onboarding.identity.languageError");
    case "skillBand":
      return t("onboarding.tennis.skillError");
  }
}

export default function IdentityScreen() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const { draft, updateDraft } = useOnboarding();
  const scrollRef = useRef<ScrollView>(null);
  const [displayName, setDisplayName] = useState(draft.displayName);
  const [birthYear, setBirthYear] = useState(draft.birthYear);
  const [adultConfirmed, setAdultConfirmed] = useState(draft.isAdultConfirmed);
  const [selectedLanguages, setSelectedLanguages] = useState(draft.languages);
  const [gender, setGender] = useState<Gender | null>(draft.gender);
  const [skillBand, setSkillBand] = useState(draft.skillBand);
  const [playIntent, setPlayIntent] = useState(draft.playIntent);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formIncomplete, setFormIncomplete] = useState(false);
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

  const clearFieldError = (field: OnboardingIdentityField) => {
    setFormIncomplete(false);
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const toggleLanguage = (language: SupportedLanguage) => {
    clearFieldError("languages");
    setSelectedLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language],
    );
  };

  const next = () => {
    const missing = validateOnboardingIdentity({
      displayName,
      birthYear,
      isAdultConfirmed: adultConfirmed,
      languages: selectedLanguages,
      skillBand,
      currentYear,
    });

    if (missing.length > 0) {
      const nextErrors: FieldErrors = {};
      for (const field of missing) {
        nextErrors[field] = fieldErrorMessage(field, t);
      }
      setErrors(nextErrors);
      setFormIncomplete(true);
      // Sticky Continue sits below the fold; field errors alone looked like a
      // dead button. Scroll up and keep a footer notice next to Continue.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setErrors({});
    setFormIncomplete(false);
    updateDraft({
      displayName: normalizeDisplayName(displayName),
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
      scrollRef={scrollRef}
      footer={
        <>
          {formIncomplete ? (
            <ErrorNotice>{t("onboarding.identity.formIncomplete")}</ErrorNotice>
          ) : null}
          <FigmaPrimaryButton label={t("common.continue")} onPress={next} />
        </>
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
            clearFieldError("displayName");
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
            clearFieldError("birthYear");
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
          clearFieldError("adultConfirm");
        }}
      />
      {errors.adultConfirm ? (
        <ErrorNotice>{errors.adultConfirm}</ErrorNotice>
      ) : null}

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
            clearFieldError("skillBand");
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
