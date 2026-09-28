import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
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
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../../src/components/AppText";
import { Avatar } from "../../src/components/AppUi";
import { ErrorNotice } from "../../src/components/FormUi";
import { Icon } from "../../src/components/Icon";
import {
  ChipButton,
  FigmaPrimaryButton,
  OnboardingFormField,
  OnboardingStepLayout,
  onboardingInputStyle,
} from "../../src/components/onboarding-ui";
import { useOwnAvatarActions } from "../../src/hooks/useOwnAvatarActions";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { exitProfileScreen } from "../../src/lib/navigation";
import { profileScreenBioPlaceholder } from "../../src/lib/profile-screen-copy";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { tennisColors } from "../../src/theme/tennis-tokens";

const languages: SupportedLanguage[] = ["en", "ar", "fr"];
const BIO_MAX_LENGTH = 300;

/**
 * Everything other players see about you, in one place: photo, name, about
 * and the languages you speak. Account details (sign-in email, password) are
 * private and live in Settings instead (founder, 2026-09-28).
 */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const avatar = useOwnAvatarActions();
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
          bio: profileQuery.data.bio ?? "",
        }
      : undefined,
  });

  const selectedLanguages = watch("languages") ?? [];

  const saveMutation = useMutation({
    mutationFn: (input: UpdateOwnProfileInput) =>
      updateOwnProfile(supabase, {
        displayName: input.displayName,
        languages: input.languages,
        // Cleared rather than stored as "": an empty about is no about.
        bio: input.bio ? input.bio : undefined,
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

  const displayName =
    watch("displayName") || profile?.display_name || t("profile.title");

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

      <View style={[styles.photoRow, { flexDirection: rowDirection }]}>
        <Avatar
          name={displayName}
          avatarPath={profile?.avatar_path}
          size={72}
        />
        <View style={styles.photoActions}>
          {avatar.busy ? (
            <ActivityIndicator color={tennisColors.violet} />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("profile.avatarChange")}
                onPress={avatar.change}
                hitSlop={{ top: 8, bottom: 8 }}
                style={({ pressed }) => [
                  styles.photoButton,
                  { flexDirection: rowDirection },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="camera" size={16} color={tennisColors.violetText} />
                <AppText style={[styles.photoChange, { writingDirection }]}>
                  {t("profile.avatarChange")}
                </AppText>
              </Pressable>
              {profile?.avatar_path ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.avatarRemove")}
                  onPress={avatar.remove}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={({ pressed }) => [
                    styles.photoButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText style={[styles.photoRemove, { writingDirection }]}>
                    {t("profile.avatarRemove")}
                  </AppText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>

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
      {errors.displayName ? (
        <ErrorNotice>{t("onboarding.identity.nameError")}</ErrorNotice>
      ) : null}

      <Controller
        control={control}
        name="bio"
        render={({ field: { onChange, onBlur, value } }) => (
          <OnboardingFormField label={t("profile.bioLabel")}>
            <TextInput
              accessibilityLabel={t("profile.bioLabel")}
              multiline
              maxLength={BIO_MAX_LENGTH}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={profileScreenBioPlaceholder(t)}
              placeholderTextColor={tennisColors.mutedForeground}
              style={[
                onboardingInputStyle.input,
                styles.bioInput,
                { writingDirection },
              ]}
              value={value ?? ""}
            />
          </OnboardingFormField>
        )}
      />

      <OnboardingFormField label={t("onboarding.identity.languages")}>
        <AppText style={[styles.hint, { writingDirection }]}>
          {t("profile.languagesHint")}
        </AppText>
        <View style={[styles.chips, { flexDirection: rowDirection }]}>
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
      {errors.languages ? (
        <ErrorNotice>{t("onboarding.identity.languageError")}</ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    photoRow: {
      alignItems: "center",
      gap: 16,
      marginBottom: 8,
    },
    photoActions: {
      gap: 4,
      alignItems: "flex-start",
    },
    photoButton: {
      minHeight: minTouchTargetPx,
      alignItems: "center",
      gap: 6,
    },
    photoChange: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 15,
      color: tennisColors.violetText,
    },
    photoRemove: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.mutedForeground,
    },
    bioInput: {
      minHeight: 100,
      textAlignVertical: "top",
      paddingTop: 12,
    },
    hint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
      marginBottom: 8,
    },
    chips: {
      flexWrap: "wrap",
      gap: 8,
    },
    pressed: {
      opacity: 0.7,
    },
  }),
);
