import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { PrimaryButton, Screen } from "../../src/components/FormUi";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t("welcome.title")} description={t("welcome.description")}>
      <PrimaryButton
        label={t("welcome.continue")}
        onPress={() => router.push("/(public)/sign-in")}
      />
    </Screen>
  );
}
