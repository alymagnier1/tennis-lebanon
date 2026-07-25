import "../src/lib/i18n";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initSentry } from "../src/lib/sentry";
import { AuthProvider } from "../src/providers/AuthProvider";
import { OnboardingProvider } from "../src/providers/OnboardingProvider";

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnboardingProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="policies" />
          </Stack>
        </OnboardingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
