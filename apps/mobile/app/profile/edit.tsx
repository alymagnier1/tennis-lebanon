import { useState } from "react";
import { TextInput, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOwnPlayerProfile, updateOwnProfile } from "@tennis-lebanon/api";
import {
  type SupportedLanguage,
  type UpdateOwnProfileInput,
  updateOwnProfileSchema,
} from "@tennis-lebanon/domain";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  ChipButton,
  FigmaPrimaryButton,
  OnboardingFormField,
  OnboardingStepLayout,
  onboardingInputStyle,
} from "../../src/components/onboarding-ui";
import { supabase } from "../../src/lib/supabase";
import { exitProfileScreen } from "../../src/lib/navigation";

const languages: SupportedLanguage[] = ["en", "ar", "fr"];

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["own-player-profile"],
    queryFn: () => getOwnPlayerProfile(supabase),
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(updateOwnProfileSchema),
    values: profileQuery.data
      ? {
          displayName: profileQuery.data.display_name,
          languages: profileQuery.data.languages as SupportedLanguage[],
        }
      : undefined,
  });

  const selectedLanguages = watch("languages") ?? [];

  const saveMutation = useMutation({
    mutationFn: (input: UpdateOwnProfileInput) =>
      updateOwnProfile(supabase, {
        displayName: input.displayName,
        languages: input.languages,
        bio: profileQuery.data?.bio ?? undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["own-player-profile"] });
      exitProfileScreen();
    },
    onError: () => setSubmitError(true),
  });

  const toggleLanguage = (language: SupportedLanguage) => {
    const next = selectedLanguages.includes(language)
      ? selectedLanguages.filter((item) => item !== language)
      : [...selectedLanguages, language];
    setValue("languages", next, { shouldValidate: true });
  };

  return (
    <OnboardingStepLayout
      title={t("profile.editTitle")}
      description={t("profile.editDescription")}
      onBack={() => exitProfileScreen()}
      footer={
        <FigmaPrimaryButton
          label={t("profile.saveProfile")}
          loading={saveMutation.isPending}
          onPress={handleSubmit((values) => saveMutation.mutate(values))}
        />
      }
    >
      {submitError ? <ErrorNotice>{t("profile.saveError")}</ErrorNotice> : null}

      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, onBlur, value } }) => (
          <OnboardingFormField label={t("onboarding.identity.name")}>
            <TextInput
              accessibilityLabel={t("onboarding.identity.name")}
              autoCapitalize="words"
              onBlur={onBlur}
              onChangeText={onChange}
              style={onboardingInputStyle.input}
              value={value}
            />
          </OnboardingFormField>
        )}
      />

      <OnboardingFormField label={t("onboarding.identity.languages")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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

      {errors.displayName ? (
        <ErrorNotice>{t("onboarding.identity.nameError")}</ErrorNotice>
      ) : null}
      {errors.languages ? (
        <ErrorNotice>{t("onboarding.identity.languageError")}</ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}
