import "../src/lib/i18n";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTennisFonts } from "../src/hooks/useTennisFonts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initSentry } from "../src/lib/sentry";
import { AuthProvider } from "../src/providers/AuthProvider";
import { OnboardingProvider } from "../src/providers/OnboardingProvider";
import { PushTokenRegistration } from "../src/components/PushTokenRegistration";
import { NotificationDeepLinkHandler } from "../src/components/NotificationDeepLinkHandler";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const fontsLoaded = useTennisFonts();

  useEffect(() => {
    void initSentry();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PushTokenRegistration />
          <NotificationDeepLinkHandler />
          <OnboardingProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(public)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="player/[id]" />
              <Stack.Screen name="profile/availability" />
              <Stack.Screen name="profile/edit" />
              <Stack.Screen name="profile/tennis-preferences" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="match/[id]" />
              <Stack.Screen name="match/create" />
              <Stack.Screen name="clubs/index" />
              <Stack.Screen name="clubs/[id]" />
              <Stack.Screen name="invite/[token]" />
              <Stack.Screen name="policies" />
            </Stack>
          </OnboardingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
