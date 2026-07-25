import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { signInSchema, type SignInInput } from "@tennis-lebanon/domain";
import {
  ErrorNotice,
  FormField,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../src/components/FormUi";
import {
  canRequestMagicLink,
  recordMagicLinkRequest,
} from "../../src/lib/auth-cooldown";
import { getAuthRedirectUrl } from "../../src/lib/auth-redirect";
import { supabase } from "../../src/lib/supabase";

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
    <Screen title={t("auth.signInTitle")} description={t("auth.signInBody")}>
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField
            label={t("auth.emailLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error ? t("auth.emailInvalid") : undefined}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      {submitError ? (
        <ErrorNotice>
          {submitError === "cooldown"
            ? t("auth.cooldownError")
            : t("auth.sendError")}
        </ErrorNotice>
      ) : null}
      <PrimaryButton
        label={t("auth.sendLink")}
        onPress={() => void submit()}
        loading={isSubmitting}
      />
      <ErrorNotice>{t("auth.rateLimitNotice")}</ErrorNotice>
      <SecondaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}
