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
  // Signing out of `account-unavailable` left the player on it: the guard below
  // only redirected `ready` and `needsOnboarding`, so `anonymous` matched
  // nothing and nothing moved. It read as a dead button -- the sign-out had
  // actually worked.
  //
  // Scoped to that one route rather than every `anonymous` visitor, because the
  // rest of this stack is *for* signed-out people: `verify-code` after sign-up,
  // `callback` on a deep link, `update-password` during recovery. Bouncing
  // those to Welcome would break each of them.
  if (state === "anonymous" && routeName === "account-unavailable") {
    return <Redirect href="/(public)/welcome" />;
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
