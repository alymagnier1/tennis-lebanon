import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { signInSchema, type SignInInput } from "@tennis-lebanon/domain";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
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
import { useAuth } from "../../src/providers/AuthProvider";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors } from "../../src/theme/tennis-tokens";

export default function SignInScreen() {
  const { t } = useTranslation();
  const { session, state, signOut } = useAuth();
  const [submitError, setSubmitError] = useState<"send" | "cooldown" | null>(
    null,
  );
  const [signOutError, setSignOutError] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "" },
  });

  if (state === "ready") {
    return <Redirect href="/(tabs)" />;
  }

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

  const switchAccount = async () => {
    setSignOutError(false);
    try {
      await signOut();
    } catch {
      setSignOutError(true);
    }
  };

  if (state === "needsOnboarding" && session) {
    const email = session.user.email ?? "";

    return (
      <OnboardingStepLayout
        title={t("auth.alreadySignedInTitle")}
        description={t("auth.alreadySignedInBody", { email })}
        onBack={() => router.replace("/(onboarding)/consent")}
        scroll={false}
        footer={
          <>
            <FigmaPrimaryButton
              label={t("auth.continueOnboarding")}
              onPress={() => router.replace("/(onboarding)/consent")}
            />
            <FigmaSecondaryButton
              label={t("auth.useAnotherEmail")}
              onPress={() => void switchAccount()}
            />
          </>
        }
      >
        {signOutError ? (
          <ErrorNotice>{t("auth.signOutError")}</ErrorNotice>
        ) : null}
      </OnboardingStepLayout>
    );
  }

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
