import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { FigmaPrimaryButton, FigmaTextButton } from "../onboarding-ui";
import { AuthGoogleSection } from "./AuthGoogleSection";
import type { GoogleSignInFailure } from "../../lib/google-sign-in";

/**
 * Shared action stack for Log in and Sign up so the two screens pin the same
 * way: primary, social separator, Google, then the cross-link.
 */
export function AuthCredentialsActions({
  primaryLabel,
  onPrimary,
  primaryLoading,
  google,
  mode,
  switchLabel,
  onSwitch,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading: boolean;
  google: {
    available: boolean;
    busy: boolean;
    error: { reason: GoogleSignInFailure; detail?: string } | null;
    signIn: () => Promise<void>;
  };
  mode: "signIn" | "signUp";
  switchLabel: string;
  onSwitch: () => void;
}) {
  return (
    <View style={styles.stack}>
      <FigmaPrimaryButton
        label={primaryLabel}
        onPress={onPrimary}
        loading={primaryLoading}
        hero
      />
      <AuthGoogleSection
        available={google.available}
        busy={google.busy}
        error={google.error}
        mode={mode}
        onPress={() => void google.signIn()}
      />
      <FigmaTextButton label={switchLabel} onPress={onSwitch} />
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    stack: {
      gap: 10,
      paddingTop: 16,
    },
  }),
);
