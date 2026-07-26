import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { PrimaryButton, Screen } from "../../src/components/FormUi";
import { CREATE_MATCH_ROUTE } from "../../src/lib/routes";
import { useAuth } from "../../src/providers/AuthProvider";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  return (
    <Screen
      title={t("home.title", { name: profile?.display_name ?? "" })}
      description={t("home.m3Description")}
    >
      <PrimaryButton
        label={t("matches.create.cta")}
        onPress={() => router.push(CREATE_MATCH_ROUTE)}
      />
    </Screen>
  );
}
