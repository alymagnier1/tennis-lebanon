import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { authRouteForState } from "../../src/lib/auth-routing";
import { useAuth } from "../../src/providers/AuthProvider";

export default function AuthLayout() {
  const { state } = useAuth();
  const routeName = useSegments().at(-1);

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state === "ready" || state === "needsOnboarding") {
    const destination = authRouteForState(state);
    const destName =
      typeof destination === "string" ? destination.split("/").pop() : null;
    if (destination && destName !== routeName) {
      return <Redirect href={destination} />;
    }
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
