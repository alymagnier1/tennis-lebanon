import { useState } from "react";
import { TextInput } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  passwordResetSchema,
  type PasswordResetInput,
} from "@tennis-lebanon/domain";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaPrimaryButton,
  OnboardingFormField,
  OnboardingStepLayout,
  onboardingInputStyle,
} from "../../src/components/onboarding-ui";
import {
  canSendAuthEmail,
  recordAuthEmailSent,
} from "../../src/lib/auth-cooldown";
import { getAuthRedirectUrl } from "../../src/lib/auth-redirect";
import { supabase } from "../../src/lib/supabase";
import { tennisColors } from "../../src/theme/tennis-tokens";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<"send" | "cooldown" | null>(
    null,
  );
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PasswordResetInput>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: "" },
  });

  const submit = handleSubmit(async ({ email }) => {
    setSubmitError(null);
    if (!canSendAuthEmail(email)) {
      setSubmitError("cooldown");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl(),
    });
    if (error) {
      setSubmitError("send");
      return;
    }
    recordAuthEmailSent(email);
    router.replace({
      pathname: "/(auth)/check-email",
      params: { reason: "reset" },
    });
  });

  return (
    <OnboardingStepLayout
      title={t("auth.forgotTitle")}
      description={t("auth.forgotBody")}
      onBack={() => router.back()}
      marks="quiet"
      footer={
        <FigmaPrimaryButton
          label={t("auth.sendReset")}
          hero
          onPress={() => void submit()}
          loading={isSubmitting}
        />
      }
    >
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <OnboardingFormField
            label={t("auth.emailLabel")}
            error={fieldState.error ? t("auth.emailInvalid") : undefined}
          >
            <TextInput
              accessibilityLabel={t("auth.emailLabel")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={() => void submit()}
              style={onboardingInputStyle.input}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={tennisColors.mutedForeground}
            />
          </OnboardingFormField>
        )}
      />
      {submitError ? (
        <ErrorNotice>
          {submitError === "cooldown"
            ? t("auth.cooldownError")
            : t("auth.sendError")}
        </ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}
