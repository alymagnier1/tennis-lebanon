import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../../src/components/FormUi";

export default function CheckEmailScreen() {
  const { t } = useTranslation();

  return (
    <Screen
      title={t("auth.checkEmailTitle")}
      description={t("auth.checkEmailBody")}
    >
      <PrimaryButton
        label={t("auth.openedLink")}
        onPress={() => router.replace("/")}
      />
      <SecondaryButton
        label={t("auth.useAnotherEmail")}
        onPress={() => router.replace("/(public)/sign-in")}
      />
    </Screen>
  );
}
