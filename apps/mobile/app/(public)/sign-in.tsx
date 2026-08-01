import { useState } from "react";
import { TextInput, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { signInSchema, type SignInInput } from "@tennis-lebanon/domain";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaPrimaryButton,
  FigmaTextButton,
  OnboardingFormField,
  OnboardingStepLayout,
  onboardingInputStyle,
} from "../../src/components/onboarding-ui";
import {
  canRequestMagicLink,
  recordMagicLinkRequest,
} from "../../src/lib/auth-cooldown";
import { getAuthRedirectUrl } from "../../src/lib/auth-redirect";
import { supabase } from "../../src/lib/supabase";
import { AppText } from "../../src/components/AppText";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { StyleSheet } from "react-native";

export default function SignInScreen() {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<"send" | "cooldown" | null>(
    null,
  );
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "" },
  });

  const submit = handleSubmit(async ({ email }) => {
    setSubmitError(null);
    if (!canRequestMagicLink()) {
      setSubmitError("cooldown");
      return;
    }
    recordMagicLinkRequest();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        shouldCreateUser: true,
      },
    });

    if (error) {
      setSubmitError("send");
      return;
    }
    router.replace("/(auth)/check-email");
  });

  return (
    <OnboardingStepLayout
      title={t("auth.signInTitle")}
      description={t("auth.signInBody")}
      onBack={() => router.back()}
      scroll={false}
      footer={
        <>
          <FigmaPrimaryButton
            label={t("auth.sendLink")}
            onPress={() => void submit()}
            loading={isSubmitting}
          />
          <AppText style={styles.rateLimit}>
            {t("auth.rateLimitNotice")}
          </AppText>
        </>
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
      <View style={styles.switchRow}>
        <AppText style={styles.switchText}>{t("auth.noAccount")} </AppText>
        <FigmaTextButton
          label={t("welcome.createAccount")}
          onPress={() => void submit()}
        />
      </View>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  rateLimit: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
    textAlign: "center",
    marginTop: 8,
  },
  switchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  switchText: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
  },
});
