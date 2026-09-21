import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../src/theme/create-live-sheet";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { POLICY_VERSIONS } from "@tennis-lebanon/domain";
import {
  POLICY_DOCUMENT_IDS,
  type PolicyDocumentId,
} from "@tennis-lebanon/i18n";
import { AppText } from "../src/components/AppText";
import { StatusBanner } from "../src/components/AppUi";
import { Icon } from "../src/components/Icon";
import { OnboardingStepLayout } from "../src/components/onboarding-ui";
import { PlayerProfileSection } from "../src/components/player/PlayerProfileSection";
import { ProfileMenuRow } from "../src/components/profile/ProfileMenuRow";
import { ensureLocaleResources } from "../src/lib/i18n";
import {
  isPolicyDocumentId,
  readPolicySections,
} from "../src/lib/policy-document";
import { tennisColors, tennisSpacing } from "../src/theme/tennis-tokens";
import { tennisFontFamily } from "../src/hooks/useTennisFonts";
import { useLayoutDirection } from "../src/lib/layout-direction";

const POLICY_VERSION_BY_DOC: Record<PolicyDocumentId, string> = {
  terms: POLICY_VERSIONS.terms,
  privacy: POLICY_VERSIONS.privacy,
  community: POLICY_VERSIONS.communityRules,
};

ensureLocaleResources();

export default function PoliciesScreen() {
  const { t } = useTranslation();
  const { writingDirection } = useLayoutDirection();
  const { document: param } = useLocalSearchParams<{ document?: string }>();
  const document: PolicyDocumentId = isPolicyDocumentId(param)
    ? param
    : "terms";
  const otherDocuments = POLICY_DOCUMENT_IDS.filter(
    (entry) => entry !== document,
  );
  const version = POLICY_VERSION_BY_DOC[document];
  const sections = readPolicySections(t, document);

  return (
    <OnboardingStepLayout
      title={t(`policies.${document}.title`)}
      description={t(`policies.${document}.summary`)}
      onBack={() => router.back()}
    >
      <View style={styles.content}>
        <StatusBanner
          tone="attention"
          body={`${t("policies.developmentWarning")} ${t("policies.version", { version })}`}
        />

        <AppText style={[styles.intro, { writingDirection }]}>
          {t(`policies.${document}.intro`)}
        </AppText>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <AppText
              accessibilityRole="header"
              style={[styles.sectionHeading, { writingDirection }]}
            >
              {section.heading}
            </AppText>
            <AppText style={[styles.sectionBody, { writingDirection }]}>
              {section.body}
            </AppText>
          </View>
        ))}

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
                subtitle={t(`policies.${entry}.summary`)}
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

const styles = createLiveSheet(() =>
  StyleSheet.create({
    content: {
      gap: 20,
      paddingBottom: tennisSpacing.section,
    },
    intro: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 21,
      color: tennisColors.mutedForeground,
    },
    section: {
      gap: 8,
    },
    sectionHeading: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 15,
      lineHeight: 20,
      color: tennisColors.primaryDark,
      letterSpacing: -0.2,
    },
    sectionBody: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 21,
      color: tennisColors.primaryDark,
    },
  }),
);
