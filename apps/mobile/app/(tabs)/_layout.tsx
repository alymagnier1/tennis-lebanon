import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import { authRouteForState } from "../../src/lib/auth-routing";
import { useAuth } from "../../src/providers/AuthProvider";

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
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: t("tabs.home"), headerTitle: t("tabs.home") }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: t("tabs.discover"), headerTitle: t("tabs.discover") }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: t("tabs.matches"), headerTitle: t("tabs.matches") }}
      />
      <Tabs.Screen
        name="clubs"
        options={{ title: t("tabs.clubs"), headerTitle: t("tabs.clubs") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("tabs.profile"), headerTitle: t("tabs.profile") }}
      />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
