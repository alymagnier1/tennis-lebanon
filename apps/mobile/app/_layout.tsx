import "../src/lib/i18n";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
  useEffect(() => {
    void initSentry();
  }, []);

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
