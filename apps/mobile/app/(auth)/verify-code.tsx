import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppText } from "../../src/components/AppText";
import { ErrorNotice } from "../../src/components/FormUi";
import {
  FigmaPrimaryButton,
  FigmaTextButton,
  OnboardingStepLayout,
  onboardingInputStyle,
} from "../../src/components/onboarding-ui";
import {
  canSendAuthEmail,
  recordAuthEmailSent,
} from "../../src/lib/auth-cooldown";
import { supabase } from "../../src/lib/supabase";
import {
  resendCodeFailure,
  verifyCodeFailure,
} from "../../src/lib/verify-code-error";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors } from "../../src/theme/tennis-tokens";

/** Matches `otp_length` in supabase/config.toml. */
const CODE_LENGTH = 6;

type Notice = { kind: "error"; key: string } | { kind: "sent" } | null;

/**
 * Confirms a new address with the code from the email instead of a link.
 *
 * The link flow needed `tennislebanon://` to survive the mail client, the
 * browser and the OS, and when any of those dropped it the player landed back
 * on Welcome with nothing to act on. A code needs none of that, and works when
 * the mail is read on a laptop -- which is where most people read mail.
 *
 * `verifyOtp` returns a session on success, so nothing here navigates: the auth
 * layout sees the new state and moves to onboarding on its own.
 */
export default function VerifyCodeScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const ready = code.length === CODE_LENGTH && email.length > 0 && !busy;

  const verify = async () => {
    if (!ready) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    setBusy(false);
    if (error) {
      setNotice({
        kind: "error",
        key: `auth.verifyCode.${verifyCodeFailure(error)}`,
      });
      setCode("");
    }
  };

  const resend = async () => {
    if (busy) return;
    // Same client-side mirror sign-up uses, so the player is told before the
    // round trip rather than by a rate-limit error after it.
    if (!canSendAuthEmail(email)) {
      setNotice({ kind: "error", key: "auth.verifyCode.rateLimited" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) {
      setNotice({
        kind: "error",
        key: `auth.verifyCode.${resendCodeFailure(error)}`,
      });
      return;
    }
    recordAuthEmailSent(email);
    setCode("");
    setNotice({ kind: "sent" });
  };

  return (
    <OnboardingStepLayout
      title={t("auth.verifyCode.title")}
      description={t("auth.verifyCode.body", { email })}
      onBack={() => router.replace("/(public)/sign-up")}
      marks="quiet"
      footer={
        <>
          <FigmaPrimaryButton
            label={t("auth.verifyCode.submit")}
            hero
            disabled={!ready}
            onPress={() => void verify()}
          />
          <FigmaTextButton
            label={t("auth.verifyCode.resend")}
            onPress={() => void resend()}
          />
        </>
      }
    >
      <TextInput
        accessibilityLabel={t("auth.verifyCode.inputLabel")}
        value={code}
        onChangeText={(next) => {
          // Mail clients and password managers paste the code with spaces, and
          // some keyboards offer it with a trailing one.
          setCode(next.replace(/\D/g, "").slice(0, CODE_LENGTH));
          setNotice(null);
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={CODE_LENGTH}
        style={[onboardingInputStyle.input, styles.code]}
      />
      <AppText style={styles.hint}>{t("auth.verifyCode.hint")}</AppText>
      {notice?.kind === "sent" ? (
        <AppText style={styles.sent}>{t("auth.verifyCode.sent")}</AppText>
      ) : null}
      {notice?.kind === "error" ? (
        <View style={styles.error}>
          <ErrorNotice>{t(notice.key)}</ErrorNotice>
        </View>
      ) : null}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  code: {
    fontSize: 28,
    letterSpacing: 10,
    textAlign: "center",
    fontFamily: tennisFontFamily.headingSemi,
  },
  hint: {
    marginTop: 12,
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    color: tennisColors.mutedForeground,
  },
  sent: {
    marginTop: 12,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primary,
  },
  error: {
    marginTop: 12,
  },
});
