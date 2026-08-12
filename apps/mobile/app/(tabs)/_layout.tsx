import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TennisTabBar } from "../../src/components/TennisTabBar";
import { authRouteForState } from "../../src/lib/auth-routing";
import { tennisColors } from "../../src/theme/tennis-tokens";
import { useAuth } from "../../src/providers/AuthProvider";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { state } = useAuth();

  if (state === "loading") {
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
  if (state !== "ready") {
    const destination = authRouteForState(state);
    if (destination) return <Redirect href={destination} />;
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
    <Tabs
      tabBar={(props) => <TennisTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: tennisColors.background },
        headerTintColor: tennisColors.primaryDark,
        tabBarActiveTintColor: tennisColors.primary,
        tabBarInactiveTintColor: tennisColors.mutedForeground,
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
