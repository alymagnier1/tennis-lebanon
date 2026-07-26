import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function CreateMatchLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="details"
        options={{ title: t("matches.create.title") }}
      />
      <Stack.Screen
        name="schedule"
        options={{ title: t("matches.create.scheduleTitle") }}
      />
      <Stack.Screen
        name="review"
        options={{ title: t("matches.create.reviewTitle") }}
      />
    </Stack>
  );
}
