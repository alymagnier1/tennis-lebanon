import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  scoreSkillQuestionnaire,
  type PlayIntent,
  type SkillQuestionnaire,
} from "@tennis-lebanon/domain";
import {
  Choice,
  ErrorNotice,
  PrimaryButton,
  Screen,
  formStyles,
} from "../../src/components/FormUi";
import { useOnboarding } from "../../src/providers/OnboardingProvider";

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
    <Screen
      title={t("onboarding.tennis.title")}
      description={t("onboarding.tennis.description")}
    >
      {questions.map((question) => (
        <View key={question} style={formStyles.stack}>
          <Text>{t(`onboarding.tennis.questions.${question}`)}</Text>
          {answerValues.map((value, index) => (
            <Choice
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
      <Text>{t("onboarding.tennis.provisional")}</Text>
      {intents.map((intent) => (
        <Choice
          key={intent}
          label={t(`playIntent.${intent}`)}
          selected={playIntent === intent}
          onPress={() => setPlayIntent(intent)}
        />
      ))}
      <Choice
        label={t("formats.singles")}
        selected={singles}
        onPress={() => setSingles((value) => !value)}
      />
      <Choice
        label={t("formats.doubles")}
        selected={doubles}
        onPress={() => setDoubles((value) => !value)}
      />
      {error ? (
        <ErrorNotice>{t("onboarding.tennis.formatError")}</ErrorNotice>
      ) : null}
      <PrimaryButton label={t("common.continue")} onPress={next} />
    </Screen>
  );
}
