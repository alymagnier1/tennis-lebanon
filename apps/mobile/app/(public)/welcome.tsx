import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
  AuthHeroDescription,
  AuthHeroHeadline,
  AuthHeroLayout,
  FigmaPrimaryButton,
  FigmaTextButton,
} from "../../src/components/onboarding-ui";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <AuthHeroLayout
      footer={
        <View style={{ gap: 12 }}>
          <FigmaPrimaryButton
            label={t("welcome.continue")}
            lime
            onPress={() => router.push("/(public)/sign-in")}
          />
          <FigmaTextButton
            label={t("welcome.signIn")}
            onPress={() => router.push("/(public)/sign-in")}
            onDark
          />
          <FigmaTextButton
            label={t("welcome.termsFooter")}
            onPress={() => router.push("/policies")}
            onDark
          />
        </View>
      }
    >
      <AuthHeroHeadline
        lines={[
          t("welcome.headline1"),
          t("welcome.headline2"),
          t("welcome.headline3"),
        ]}
        highlightIndex={1}
      />
      <AuthHeroDescription>{t("welcome.description")}</AuthHeroDescription>
    </AuthHeroLayout>
  );
}
