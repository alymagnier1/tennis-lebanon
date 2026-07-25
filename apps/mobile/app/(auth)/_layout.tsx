import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { authRouteForState } from "../../src/lib/auth-routing";
import { useAuth } from "../../src/providers/AuthProvider";

export default function AuthLayout() {
  const { state } = useAuth();

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state === "ready" || state === "needsOnboarding") {
    const destination = authRouteForState(state);
    if (destination) return <Redirect href={destination} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
