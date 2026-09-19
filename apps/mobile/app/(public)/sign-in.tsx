import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { signInSchema, type SignInInput } from "@tennis-lebanon/domain";
import { AppText } from "../../src/components/AppText";
import { AuthAlreadySignedIn } from "../../src/components/auth/AuthAlreadySignedIn";
import { AuthCredentialsActions } from "../../src/components/auth/AuthCredentialsActions";
import { AuthEmailPasswordFields } from "../../src/components/auth/AuthEmailPasswordFields";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaTextButton,
  OnboardingStepLayout,
} from "../../src/components/onboarding-ui";
import { useGoogleAuthButton } from "../../src/hooks/useGoogleAuthButton";
import {
  emailAuthFailure,
  type EmailAuthFailure,
} from "../../src/lib/email-auth-error";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors } from "../../src/theme/tennis-tokens";

export default function SignInScreen() {
  const { t } = useTranslation();
  const { session, state } = useAuth();
  const google = useGoogleAuthButton();
  const [submitError, setSubmitError] = useState<EmailAuthFailure | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  if (state === "ready") {
    return <Redirect href="/(tabs)" />;
  }

  if (state === "needsOnboarding" && session) {
    return <AuthAlreadySignedIn />;
  }

  const submit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setSubmitError(emailAuthFailure(error));
      return;
    }
    router.replace("/");
  });

  return (
    <OnboardingStepLayout
      title={t("auth.signInTitle")}
      description={t("auth.signInBody")}
      onBack={() => router.back()}
      avoidKeyboard={false}
      marks="signin"
    >
      <View style={styles.sheet}>
        <AuthEmailPasswordFields
          control={control}
          onSubmitPassword={() => void submit()}
        />
        <View style={styles.forgotRow}>
          <FigmaTextButton
            label={t("auth.forgotPassword")}
            align="start"
            onPress={() => router.push("/(public)/forgot-password")}
          />
        </View>
        {submitError ? (
          <>
            <ErrorNotice>
              {submitError === "invalid"
                ? t("auth.invalidCredentials")
                : submitError === "unconfirmed"
                  ? t("auth.emailUnconfirmed")
                  : t("auth.signInError")}
            </ErrorNotice>
            {/*
              An account created through Google has no password, so a password
              typed against it fails as "incorrect" -- and the player goes off
              to reset a password that never existed. Supabase will not say
              which providers an address holds, deliberately, so this names the
              possibility rather than the account: it needs no lookup and
              cannot be used to test whether an address is registered.
            */}
            {submitError === "invalid" ? (
              <AppText style={styles.hint}>{t("auth.googleHint")}</AppText>
            ) : null}
          </>
        ) : null}
        <View style={styles.spacer} />
        <AuthCredentialsActions
          primaryLabel={t("auth.logIn")}
          onPrimary={() => void submit()}
          primaryLoading={isSubmitting}
          google={google}
          switchLabel={t("auth.needAccount")}
          onSwitch={() => router.replace("/(public)/sign-up")}
        />
      </View>
    </OnboardingStepLayout>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    sheet: {
      flexGrow: 1,
    },
    spacer: {
      flexGrow: 1,
      minHeight: 24,
    },
    forgotRow: {
      alignItems: "flex-start",
      paddingTop: 12,
      marginBottom: 8,
    },
    hint: {
      marginTop: 8,
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
  }),
);
