import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  scoreSkillQuestionnaire,
  type PlayIntent,
  type SkillQuestionnaire,
} from "@tennis-lebanon/domain";
import { ErrorNotice } from "../../src/components/FormUi";
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
import { StyleSheet } from "react-native";

const questions: (keyof SkillQuestionnaire)[] = [
  "experience",
  "frequency",
  "rally",
  "matchExperience",
];
const answerValues = [0, 2, 4] as const;
const intents: PlayIntent[] = ["social", "competitive", "either"];

export default function TennisProfileScreen() {
  const { t } = useTranslation();
  const { draft, updateDraft } = useOnboarding();
  const [answers, setAnswers] = useState(draft.skillAnswers);
  const [playIntent, setPlayIntent] = useState(draft.playIntent);
  const [singles, setSingles] = useState(draft.prefersSingles);
  const [doubles, setDoubles] = useState(draft.prefersDoubles);
  const [error, setError] = useState(false);

  const next = () => {
    if (!singles && !doubles) {
      setError(true);
      return;
    }
    const skillBand = scoreSkillQuestionnaire(answers);
    updateDraft({
      skillAnswers: answers,
      skillBand,
      playIntent,
      prefersSingles: singles,
      prefersDoubles: doubles,
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
        <FigmaPrimaryButton label={t("common.continue")} onPress={next} />
      }
    >
      {questions.map((question) => (
        <View key={question} style={styles.block}>
          <AppText style={styles.question}>
            {t(`onboarding.tennis.questions.${question}`)}
          </AppText>
          {answerValues.map((value, index) => (
            <SelectionCard
              key={value}
              label={t(`onboarding.tennis.answerLevels.${index}`)}
              selected={answers[question] === value}
              onPress={() =>
                setAnswers((current) => ({ ...current, [question]: value }))
              }
            />
          ))}
        </View>
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
      <View style={styles.chips}>
        <ChipButton
          label={t("formats.singles")}
          selected={singles}
          onPress={() => setSingles((value) => !value)}
        />
        <ChipButton
          label={t("formats.doubles")}
          selected={doubles}
          onPress={() => setDoubles((value) => !value)}
        />
      </View>
      {error ? (
        <ErrorNotice>{t("onboarding.tennis.formatError")}</ErrorNotice>
      ) : null}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 16,
  },
  question: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primaryDark,
    marginBottom: 8,
  },
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
});
