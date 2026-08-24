import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { PlayIntent, SkillBand } from "@tennis-lebanon/domain";
import { AppText } from "../../src/components/AppText";
import {
  ChipButton,
  FigmaPrimaryButton,
  OnboardingStepLayout,
  SelectionCard,
} from "../../src/components/onboarding-ui";
import { useOnboarding } from "../../src/providers/OnboardingProvider";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { tennisColors } from "../../src/theme/tennis-tokens";

/**
 * Ordered weakest to strongest, matching the database enum.
 *
 * This replaced a four-question scored questionnaire. The questionnaire's
 * defence was that it resists inflation, but its four inputs were themselves
 * self-assessments, so it collected four judgements instead of one and then
 * hid the arithmetic. Two things settled it: `ProfileSkillBandSection` already
 * lets a player pick a band directly for as long as their rating is
 * provisional, so onboarding was deriving a value the rest of the app asks for
 * outright; and the questionnaire's defaults were all zero while zero was also
 * the first option, so anyone who tapped straight through was silently filed as
 * a beginner with no way to tell that apart from a real answer.
 *
 * The labels describe what a player does rather than what they are. Nobody
 * inflates "I am still learning to rally" the way they inflate "Advanced", so
 * the anti-inflation argument survives the change at a fifth of the taps.
 */
const bands: SkillBand[] = [
  "beginner",
  "improving",
  "intermediate",
  "advanced",
  "competitive",
];
const intents: PlayIntent[] = ["social", "competitive", "either"];

export default function TennisProfileScreen() {
  const { t } = useTranslation();
  const { draft, updateDraft } = useOnboarding();
  const [skillBand, setSkillBand] = useState(draft.skillBand);
  const [playIntent, setPlayIntent] = useState(draft.playIntent);

  const next = () => {
    if (!skillBand) {
      return;
    }

    updateDraft({
      skillBand,
      playIntent,
      // Format is chosen per match; keep both open for discovery liquidity.
      prefersSingles: true,
      prefersDoubles: true,
    });
    router.push("/(onboarding)/zones");
  };

  return (
    <OnboardingStepLayout
      title={t("onboarding.tennis.title")}
      description={t("onboarding.tennis.description")}
      step={3}
      totalSteps={6}
      onBack={() => router.back()}
      footer={
        <FigmaPrimaryButton
          label={t("common.continue")}
          disabled={!skillBand}
          onPress={next}
        />
      }
    >
      {bands.map((band) => (
        <SelectionCard
          key={band}
          label={t(`onboarding.tennis.bands.${band}`)}
          // The band name the rest of the app will show them afterwards.
          description={t(`skillBands.${band}`)}
          selected={skillBand === band}
          onPress={() => setSkillBand(band)}
        />
      ))}
      <AppText style={styles.section}>
        {t("onboarding.tennis.provisional")}
      </AppText>
      <View style={styles.chips}>
        {intents.map((intent) => (
          <ChipButton
            key={intent}
            label={t(`playIntent.${intent}`)}
            selected={playIntent === intent}
            onPress={() => setPlayIntent(intent)}
          />
        ))}
      </View>
    </OnboardingStepLayout>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    section: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 16,
      color: tennisColors.primaryDark,
      marginBottom: 12,
      marginTop: 8,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 8,
    },
  }),
);
