import { useState } from "react";
import { TextInput } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  newPasswordSchema,
  type NewPasswordInput,
} from "@tennis-lebanon/domain";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaPrimaryButton,
  OnboardingFormField,
  OnboardingStepLayout,
  onboardingInputStyle,
} from "../../src/components/onboarding-ui";
import { clearPasswordRecoveryPending } from "../../src/lib/password-recovery";
import { supabase } from "../../src/lib/supabase";
import { tennisColors } from "../../src/theme/tennis-tokens";

export default function UpdatePasswordScreen() {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState(false);
  /**
   * Recovery reaches this screen to *replace* a password; settings reaches it
   * to give a Google-created account its first one. Same call either way --
   * `secure_password_change` is off, so no reauthentication -- but telling
   * somebody they are updating a password they have never had is a small lie
   * that makes them hunt for the old one.
   */
  const params = useLocalSearchParams<{ mode?: string }>();
  const setting = params.mode === "set";
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "" },
  });

  const submit = handleSubmit(async ({ password }) => {
    setSubmitError(false);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitError(true);
      return;
    }
    clearPasswordRecoveryPending();
    router.replace("/");
  });

  return (
    <OnboardingStepLayout
      title={t(setting ? "auth.setPasswordTitle" : "auth.updatePasswordTitle")}
      description={t(
        setting ? "auth.setPasswordBody" : "auth.updatePasswordBody",
      )}
      footer={
        <FigmaPrimaryButton
          label={t("auth.savePassword")}
          onPress={() => void submit()}
          loading={isSubmitting}
        />
      }
    >
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <OnboardingFormField
            label={t("auth.passwordLabel")}
            error={fieldState.error ? t("auth.passwordInvalid") : undefined}
          >
            <TextInput
              accessibilityLabel={t("auth.passwordLabel")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              style={onboardingInputStyle.input}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={tennisColors.mutedForeground}
            />
          </OnboardingFormField>
        )}
      />
      {submitError ? (
        <ErrorNotice>{t("auth.updatePasswordError")}</ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}
