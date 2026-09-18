import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
  AuthHeroDescription,
  AuthHeroHeadline,
  AuthHeroLayout,
  FigmaPrimaryButton,
  FigmaSecondaryButton,
  FigmaTextButton,
} from "../../src/components/onboarding-ui";
import { useHeroVariant } from "../../src/providers/HeroVariantProvider";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { family } = useHeroVariant();
  const light = family === "light";

  return (
    <AuthHeroLayout
      headline={
        <AuthHeroHeadline
          lines={[
            t("welcome.headline1"),
            t("welcome.headline2"),
            t("welcome.headline3"),
          ]}
          highlightIndex={1}
        />
      }
      description={
        <AuthHeroDescription>{t("welcome.description")}</AuthHeroDescription>
      }
      footer={
        <View style={{ gap: 10 }}>
          <FigmaPrimaryButton
            label={t("welcome.createAccount")}
            lime={!light}
            hero={light}
            onPress={() => router.push("/(public)/sign-up")}
          />
          <FigmaSecondaryButton
            label={t("welcome.logIn")}
            ghostOnDark={!light}
            ghostOnLight={light}
            onPress={() => router.push("/(public)/sign-in")}
          />
          <FigmaTextButton
            label={t("welcome.termsFooter")}
            onPress={() => router.push("/policies")}
            onDark={!light}
          />
        </View>
      }
    />
  );
}
