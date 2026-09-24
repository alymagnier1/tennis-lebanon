import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { signUpSchema, type SignUpInput } from "@tennis-lebanon/domain";
import { AuthAlreadySignedIn } from "../../src/components/auth/AuthAlreadySignedIn";
import { AuthCredentialsActions } from "../../src/components/auth/AuthCredentialsActions";
import { AuthEmailPasswordFields } from "../../src/components/auth/AuthEmailPasswordFields";
import { ErrorNotice } from "../../src/components/FormUi";
import { OnboardingStepLayout } from "../../src/components/onboarding-ui";
import { useGoogleAuthButton } from "../../src/hooks/useGoogleAuthButton";
import {
  canSendAuthEmail,
  recordAuthEmailSent,
} from "../../src/lib/auth-cooldown";
import { getAuthRedirectUrl } from "../../src/lib/auth-redirect";
import {
  emailAuthFailure,
  type EmailAuthFailure,
} from "../../src/lib/email-auth-error";
import { exitAuthScreen } from "../../src/lib/navigation";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { session, state } = useAuth();
  const google = useGoogleAuthButton();
  const [submitError, setSubmitError] = useState<
    EmailAuthFailure | "cooldown" | null
  >(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
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
    if (!canSendAuthEmail(email)) {
      setSubmitError("cooldown");
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    if (error) {
      setSubmitError(emailAuthFailure(error));
      return;
    }
    // Confirm-email on can return 200 with an empty identities list when the
    // address is already registered, so we do not send them on to the code.
    if (data.user && data.user.identities?.length === 0) {
      setSubmitError("exists");
      return;
    }
    // Confirm-email off returns a session; confirm-email on sends mail.
    if (data.session) {
      router.replace("/");
      return;
    }
    // Only here has an email actually gone out: the branches above either
    // failed, found an existing account, or signed in without one.
    recordAuthEmailSent(email);
    router.replace({
      pathname: "/(auth)/verify-code",
      params: { email },
    });
  });

  return (
    <OnboardingStepLayout
      title={t("auth.signUpTitle")}
      description={t("auth.signUpBody")}
      onBack={exitAuthScreen}
      avoidKeyboard={false}
      marks="signup"
    >
      <View style={styles.sheet}>
        <AuthEmailPasswordFields
          control={control}
          onSubmitPassword={() => void submit()}
        />
        {submitError ? (
          <ErrorNotice>
            {submitError === "cooldown"
              ? t("auth.cooldownError")
              : submitError === "exists"
                ? t("auth.emailExists")
                : submitError === "weak"
                  ? t("auth.passwordInvalid")
                  : t("auth.signUpError")}
          </ErrorNotice>
        ) : null}
        <View style={styles.spacer} />
        <AuthCredentialsActions
          primaryLabel={t("auth.createAccount")}
          onPrimary={() => void submit()}
          primaryLoading={isSubmitting}
          google={google}
          switchLabel={t("auth.haveAccount")}
          onSwitch={() => router.replace("/(public)/sign-in")}
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
  }),
);
