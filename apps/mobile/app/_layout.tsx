import "../src/lib/i18n";
import { useEffect } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTennisFonts } from "../src/hooks/useTennisFonts";
import * as Network from "expo-network";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { initSentry } from "../src/lib/sentry";
import { AuthProvider } from "../src/providers/AuthProvider";
import { ThemeProvider } from "../src/providers/ThemeProvider";
import { OnboardingProvider } from "../src/providers/OnboardingProvider";
import { HeroVariantProvider } from "../src/providers/HeroVariantProvider";
import { PushTokenRegistration } from "../src/components/PushTokenRegistration";
import { NotificationLocaleSync } from "../src/components/NotificationLocaleSync";
import { NotificationDeepLinkHandler } from "../src/components/NotificationDeepLinkHandler";
import { UnreadMessagesWatcher } from "../src/components/UnreadMessagesWatcher";
import { AppErrorBoundary } from "../src/components/AppErrorBoundary";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { ToastProvider } from "../src/providers/ToastProvider";
import { ConfirmDialogProvider } from "../src/providers/ConfirmDialogProvider";
import { installDeepLinkCapture } from "../src/lib/deep-link-buffer";
import {
  createBackendProbe,
  createOnlineBridge,
} from "../src/lib/connectivity";
import { env } from "../src/lib/env";
import { tennisColors } from "../src/theme/tennis-tokens";

/*
 * At module scope, not in an effect: a link that resumes a running app fires
 * its `url` event before the destination screen mounts, so a listener owned by
 * that screen never hears it. This is the earliest point the app can subscribe.
 */
installDeepLinkCapture(Linking);

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

// The other half of the same problem. React Query's default onlineManager is a
// browser one too, so on native it assumes the device is always connected: a
// request made with no signal did not wait, it burned the one configured retry
// and surfaced as "couldn't load". Pilot players are on Lebanese mobile data,
// where losing signal for a minute is ordinary, so queries should pause and
// resume rather than fail. Android's "validated" flag alone is not trusted:
// see `createOnlineBridge`.
onlineManager.setEventListener((setOnline) =>
  createOnlineBridge({
    subscribe: (listener) => {
      const subscription = Network.addNetworkStateListener(listener);
      return () => subscription.remove();
    },
    subscribeForeground: (onForeground) => {
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") onForeground();
      });
      return () => subscription.remove();
    },
    readState: () => Network.getNetworkStateAsync(),
    probe: createBackendProbe({
      baseUrl: env.SUPABASE_URL,
      apiKey: env.SUPABASE_ANON_KEY,
    }),
    setOnline,
  }),
);

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
      <ThemeProvider>
        {/* Inside the safe area so the fallback respects the notch, but outside
          every other provider: a throw in AuthProvider or OnboardingProvider is
          exactly the case that used to blank the screen. */}
        <AppErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <ConfirmDialogProvider>
                <AuthProvider>
                  <PushTokenRegistration />
                  <NotificationLocaleSync />
                  <NotificationDeepLinkHandler />
                  <UnreadMessagesWatcher />
                  <OnboardingProvider>
                    <HeroVariantProvider>
                      {/* Above the Stack so the bar is visible on whatever
                          screen the player happens to be on when signal
                          drops, rather than per-screen. */}
                      <OfflineBanner />
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
                        <Stack.Screen name="profile/notifications" />
                        <Stack.Screen name="profile/where-i-play" />
                        <Stack.Screen name="profile/tennis-preferences" />
                        <Stack.Screen name="notifications" />
                        <Stack.Screen name="match/[id]" />
                        <Stack.Screen name="match/create" />
                        <Stack.Screen name="clubs/[id]" />
                        <Stack.Screen name="invite/[token]" />
                        <Stack.Screen name="policies" />
                      </Stack>
                    </HeroVariantProvider>
                  </OnboardingProvider>
                </AuthProvider>
              </ConfirmDialogProvider>
            </ToastProvider>
          </QueryClientProvider>
        </AppErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
