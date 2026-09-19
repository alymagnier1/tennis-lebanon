import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { authGroupRedirect } from "../../src/lib/auth-routing";
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
  const destination = authGroupRedirect(state, routeName);
  if (destination) return <Redirect href={destination} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
