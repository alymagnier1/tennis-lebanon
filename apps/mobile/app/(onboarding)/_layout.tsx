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
  /**
   * `complete` is the one step the player reaches *after* onboarding stops
   * being incomplete: the step before it writes the profile, `state` flips to
   * `ready`, and the gate below then redirected to the tabs. The screen still
   * rendered, for about one frame, which read as it being skipped.
   */
  const isDoneStep = pathname.endsWith("/complete");

  if (state !== "needsOnboarding" && !(state === "ready" && isDoneStep)) {
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
