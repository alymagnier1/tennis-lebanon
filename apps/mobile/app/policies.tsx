import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { POLICY_VERSIONS } from "@tennis-lebanon/domain";
import { StatusBanner } from "../src/components/AppUi";
import { Icon } from "../src/components/Icon";
import { OnboardingStepLayout } from "../src/components/onboarding-ui";
import { PlayerProfileSection } from "../src/components/player/PlayerProfileSection";
import { ProfileMenuRow } from "../src/components/profile/ProfileMenuRow";
import { tennisColors } from "../src/theme/tennis-tokens";

type PolicyDocument = "terms" | "privacy" | "community";

const POLICY_DOCS: PolicyDocument[] = ["terms", "privacy", "community"];

const POLICY_VERSION_BY_DOC: Record<PolicyDocument, string> = {
  terms: POLICY_VERSIONS.terms,
  privacy: POLICY_VERSIONS.privacy,
  community: POLICY_VERSIONS.communityRules,
};

function isPolicyDocument(value: unknown): value is PolicyDocument {
  return value === "terms" || value === "privacy" || value === "community";
}

export default function PoliciesScreen() {
  const { t } = useTranslation();
  const { document: param } = useLocalSearchParams<{ document?: string }>();
  const document = isPolicyDocument(param) ? param : "terms";
  const otherDocuments = POLICY_DOCS.filter((entry) => entry !== document);
  const version = POLICY_VERSION_BY_DOC[document];

  return (
    <OnboardingStepLayout
      title={t(`policies.${document}.title`)}
      description={t(`policies.${document}.body`)}
      onBack={() => router.back()}
    >
      <View style={{ gap: 20 }}>
        <StatusBanner
          tone="attention"
          body={`${t("policies.developmentWarning")} ${t("policies.version", { version })}`}
        />

        {otherDocuments.length > 0 ? (
          <PlayerProfileSection
            title={t("policies.otherDocuments")}
            variant="grouped"
          >
            {otherDocuments.map((entry, index) => (
              <ProfileMenuRow
                key={entry}
                icon={
                  <Icon name="info" size={16} color={tennisColors.primary} />
                }
                label={t(`policies.${entry}.title`)}
                subtitle={t(`policies.${entry}.body`)}
                onPress={() => router.replace(`/policies?document=${entry}`)}
                showDivider={index > 0}
              />
            ))}
          </PlayerProfileSection>
        ) : null}
      </View>
    </OnboardingStepLayout>
  );
}
