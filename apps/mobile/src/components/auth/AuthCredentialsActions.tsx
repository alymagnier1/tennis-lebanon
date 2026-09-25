import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { FigmaPrimaryButton, FigmaTextButton } from "../onboarding-ui";
import { AuthGoogleSection } from "./AuthGoogleSection";
import type { GoogleSignInFailure } from "../../lib/google-sign-in";

/**
 * Shared action stack for Log in and Sign up so the two screens pin the same
 * way: primary, social separator, Google, then the cross-link.
 *
 * Deliberately identical on both. Google signs a returning player in and
 * creates an account for a new one -- it is one action, and labelling it two
 * ways asked the reader to know which they were, which is the question the
 * provider already answered.
 */
export function AuthCredentialsActions({
  primaryLabel,
  onPrimary,
  primaryLoading,
  google,
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
  switchLabel: string;
  onSwitch: () => void;
}) {
  return (
    <View style={styles.stack}>
      <FigmaPrimaryButton
        label={primaryLabel}
        onPress={onPrimary}
        loading={primaryLoading}
      />
      <AuthGoogleSection
        available={google.available}
        busy={google.busy}
        error={google.error}
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
