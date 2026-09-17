import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { ErrorNotice } from "../FormUi";
import { FigmaSecondaryButton, GoogleMark } from "../onboarding-ui";
import { env } from "../../lib/env";
import type { GoogleSignInFailure } from "../../lib/google-sign-in";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors } from "../../theme/tennis-tokens";

export function AuthGoogleSection({
  available,
  busy,
  error,
  onPress,
  mode,
}: {
  available: boolean;
  busy: boolean;
  error: { reason: GoogleSignInFailure; detail?: string } | null;
  onPress: () => void;
  mode: "signIn" | "signUp";
}) {
  const { t } = useTranslation();
  if (!available) return null;

  return (
    <>
      <View style={styles.divider}>
        <View style={styles.rule} />
        <AppText style={styles.separator}>
          {mode === "signUp"
            ? t("auth.socialSeparatorSignUp")
            : t("auth.socialSeparatorSignIn")}
        </AppText>
        <View style={styles.rule} />
      </View>
      <FigmaSecondaryButton
        label={t("auth.googleButton")}
        onPress={onPress}
        loading={busy}
        neutral
        leading={<GoogleMark />}
      />
      {error ? (
        <>
          <ErrorNotice>
            {error.reason === "unavailable"
              ? t("auth.googleUnavailable")
              : t("auth.googleError")}
          </ErrorNotice>
          {env.APP_ENV !== "production" && error.detail ? (
            <AppText style={styles.diagnostic}>{error.detail}</AppText>
          ) : null}
        </>
      ) : null}
    </>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 20,
      marginBottom: 14,
    },
    rule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: tennisColors.border,
    },
    separator: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 11.5,
      letterSpacing: 0.4,
      color: tennisColors.mutedForeground,
    },
    diagnostic: {
      fontFamily: tennisFontFamily.body,
      fontSize: 11,
      opacity: 0.7,
      marginTop: 6,
    },
  }),
);
