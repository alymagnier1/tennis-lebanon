import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View, type ColorValue } from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "@tennis-lebanon/ui";
import { Icon, type IconName } from "../../src/components/Icon";
import { authRouteForState } from "../../src/lib/auth-routing";
import { useAuth } from "../../src/providers/AuthProvider";

function tabIcon(name: IconName) {
  return function TabBarIcon({
    color,
    size,
  }: {
    color: ColorValue;
    size: number;
  }) {
    return <Icon name={name} size={size} color={String(color)} />;
  };
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { state } = useAuth();

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state !== "ready") {
    const destination = authRouteForState(state);
    if (destination) return <Redirect href={destination} />;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.neutral[500],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          headerTitle: t("tabs.home"),
          tabBarIcon: tabIcon("home"),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("tabs.discover"),
          headerTitle: t("tabs.discover"),
          tabBarIcon: tabIcon("discover"),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t("tabs.matches"),
          headerTitle: t("tabs.matches"),
          tabBarIcon: tabIcon("matches"),
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          title: t("tabs.clubs"),
          headerTitle: t("tabs.clubs"),
          tabBarIcon: tabIcon("clubs"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          headerTitle: t("tabs.profile"),
          tabBarIcon: tabIcon("profile"),
        }}
      />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
