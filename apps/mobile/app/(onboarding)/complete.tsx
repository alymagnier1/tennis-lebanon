import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../src/components/AppText";
import { Icon } from "../../src/components/Icon";
import {
  CourtGridOverlay,
  FigmaPrimaryButton,
} from "../../src/components/onboarding-ui";
import { useAuth } from "../../src/providers/AuthProvider";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../../src/theme/tennis-tokens";

export default function OnboardingCompleteScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const name = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <CourtGridOverlay />
      <View style={styles.content}>
        <View style={styles.icon}>
          <Icon name="court" size={44} color={tennisColors.primary} />
        </View>
        <AppText style={styles.title}>{t("onboarding.complete.title")}</AppText>
        <AppText style={styles.titleAccent}>
          {t("onboarding.complete.titleAccent", { name })}
        </AppText>
        <AppText style={styles.description}>
          {t("onboarding.complete.description")}
        </AppText>
      </View>
      <FigmaPrimaryButton
        label={t("onboarding.complete.cta")}
        lime
        // Favourite clubs are what pre-fill the create-match screen, and no
        // onboarding step can collect them: the club RPCs require a completed
        // profile. This is the first moment they can be saved.
        onPress={() => router.replace("/profile/where-i-play?firstRun=1")}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tennisColors.primary,
    paddingHorizontal: 32,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: tennisColors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 36,
    color: tennisColors.white,
    textAlign: "center",
    letterSpacing: -1,
  },
  titleAccent: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 36,
    color: tennisColors.lime,
    textAlign: "center",
    letterSpacing: -1,
    marginBottom: 12,
  },
  description: {
    fontFamily: tennisFontFamily.body,
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginBottom: 28,
    maxWidth: 300,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  statCard: {
    flex: 1,
    backgroundColor: tennisColors.heroOverlay,
    borderWidth: 1,
    borderColor: tennisColors.heroBorder,
    borderRadius: tennisRadii.lg,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 28,
    color: tennisColors.lime,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  cta: {
    marginTop: 16,
  },
});
