import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, spacing } from "@tennis-lebanon/ui";
import { PrimaryButton } from "../src/components/FormUi";
import { authRouteForState } from "../src/lib/auth-routing";
import { useAuth } from "../src/providers/AuthProvider";

/**
 * Central route gate. Group layouts repeat these checks so direct deep links
 * cannot expose protected screens while the session is being restored.
 */
export default function IndexScreen() {
  const { t } = useTranslation();
  const { state, refreshProfile } = useAuth();

  const destination = authRouteForState(state);
  if (destination) return <Redirect href={destination} />;

  return (
    <View style={styles.container}>
      {state === "loading" ? <ActivityIndicator /> : null}
      <Text style={state === "error" ? styles.error : styles.status}>
        {state === "error" ? t("auth.sessionError") : t("auth.restoring")}
      </Text>
      {state === "error" ? (
        <PrimaryButton
          label={t("common.retry")}
          onPress={() => void refreshProfile()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.neutral[0],
  },
  status: {
    color: colors.neutral[700],
  },
  error: {
    color: colors.danger[500],
  },
});
