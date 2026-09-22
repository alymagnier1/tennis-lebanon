import { useEffect } from "react";
import { Redirect, Tabs, router } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TennisTabBar } from "../../src/components/TennisTabBar";
import { authRouteForState } from "../../src/lib/auth-routing";
import { takePendingInvite } from "../../src/lib/pending-invite";
import { inviteTokenRoute } from "../../src/lib/routes";
import { useTennisTheme } from "../../src/providers/ThemeProvider";
import { useAuth } from "../../src/providers/AuthProvider";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const { colors } = useTennisTheme();

  // Sign-in and the end of onboarding both land here, so this is the one place
  // that sees every way a player becomes ready. An invite they opened before
  // they had an account is waiting for them; open it on top of Home.
  useEffect(() => {
    if (state !== "ready") return;
    void takePendingInvite().then((token) => {
      if (token) router.push(inviteTokenRoute(token));
    });
  }, [state]);

  if (state === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (state !== "ready") {
    const destination = authRouteForState(state);
    if (destination) return <Redirect href={destination} />;
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <TennisTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primaryDark,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          overflow: "visible",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("tabs.discover"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t("tabs.matches"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          href: null,
          title: t("tabs.clubs"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
