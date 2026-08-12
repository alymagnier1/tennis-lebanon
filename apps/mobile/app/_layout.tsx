import "../src/lib/i18n";
import { useEffect } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTennisFonts } from "../src/hooks/useTennisFonts";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { initSentry } from "../src/lib/sentry";
import { AuthProvider } from "../src/providers/AuthProvider";
import { OnboardingProvider } from "../src/providers/OnboardingProvider";
import { PushTokenRegistration } from "../src/components/PushTokenRegistration";
import { NotificationDeepLinkHandler } from "../src/components/NotificationDeepLinkHandler";
import { AppErrorBoundary } from "../src/components/AppErrorBoundary";
import { ToastProvider } from "../src/providers/ToastProvider";
import { ConfirmDialogProvider } from "../src/providers/ConfirmDialogProvider";
import { tennisColors } from "../src/theme/tennis-tokens";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// React Query refetches on window focus by default, but that signal is a
// browser one: on native nothing ever reports focus, so a query that went stale
// while the app sat in the background stayed stale after returning to it. This
// is the half of "I had to restart the app" that realtime does not cover.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (state) => {
    handleFocus(state === "active");
  });
  return () => subscription.remove();
});

export default function RootLayout() {
  const fontsLoaded = useTennisFonts();

  useEffect(() => {
    void initSentry();
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tennisColors.background,
        }}
      >
        <ActivityIndicator color={tennisColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {/* Inside the safe area so the fallback respects the notch, but outside
          every other provider: a throw in AuthProvider or OnboardingProvider is
          exactly the case that used to blank the screen. */}
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ConfirmDialogProvider>
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
                  <Stack.Screen name="profile/match-defaults" />
                  <Stack.Screen name="profile/where-i-play" />
                  <Stack.Screen name="profile/tennis-preferences" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="match/[id]" />
                  <Stack.Screen name="match/create" />
                  <Stack.Screen name="clubs/[id]" />
                  <Stack.Screen name="invite/[token]" />
                  <Stack.Screen name="policies" />
                </Stack>
              </OnboardingProvider>
            </AuthProvider>
            </ConfirmDialogProvider>
          </ToastProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
