import { useEffect } from "react";
import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { trackOnboardingStep } from "../../src/lib/analytics";
import { authRouteForState } from "../../src/lib/auth-routing";
import { useAuth } from "../../src/providers/AuthProvider";
import { useOnboarding } from "../../src/providers/OnboardingProvider";

export default function OnboardingLayout() {
  const { state } = useAuth();
  const { hydrated } = useOnboarding();
  const pathname = usePathname();

  /**
   * Step-level drop-off, tracked here rather than in each screen: the six steps
   * need no edits and a seventh is covered the day it is added. Keyed on
   * pathname so it fires once per step, not once per render.
   */
  useEffect(() => {
    if (state === "needsOnboarding" && hydrated) {
      trackOnboardingStep(pathname);
    }
  }, [hydrated, pathname, state]);

  if (state === "loading" || !hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state !== "needsOnboarding") {
    const destination = authRouteForState(state);
    if (destination) return <Redirect href={destination} />;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
