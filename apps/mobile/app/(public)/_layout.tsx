import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { publicRouteRedirect } from "../../src/lib/auth-routing";
import { useAuth } from "../../src/providers/AuthProvider";

export default function PublicLayout() {
  const { state } = useAuth();
  const segments = useSegments();
  const routeName = segments.at(-1);

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const destination = publicRouteRedirect(state, routeName);
  if (destination) return <Redirect href={destination} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
