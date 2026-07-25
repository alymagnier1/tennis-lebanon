import { Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { PrimaryButton, Screen, formStyles } from "../../src/components/FormUi";
import { useAuth } from "../../src/providers/AuthProvider";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  return (
    <Screen
      title={profile?.display_name ?? t("profile.title")}
      description={t("profile.provisional")}
    >
      <View style={formStyles.summary}>
        <Text style={formStyles.summaryLabel}>{t("profile.languages")}</Text>
        <Text style={formStyles.summaryValue}>
          {profile?.languages.join(", ").toUpperCase()}
        </Text>
        <Text style={formStyles.summaryLabel}>{t("profile.adultStatus")}</Text>
        <Text style={formStyles.summaryValue}>
          {profile?.is_adult_confirmed
            ? t("profile.confirmed")
            : t("profile.incomplete")}
        </Text>
      </View>
      <PrimaryButton
        label={t("settings.title")}
        onPress={() => router.push("/(tabs)/settings")}
      />
    </Screen>
  );
}
