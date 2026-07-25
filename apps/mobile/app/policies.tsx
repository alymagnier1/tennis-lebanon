import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { POLICY_VERSIONS } from "@tennis-lebanon/domain";
import {
  ErrorNotice,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "../src/components/FormUi";

type PolicyDocument = "terms" | "privacy" | "community";

function isPolicyDocument(value: unknown): value is PolicyDocument {
  return value === "terms" || value === "privacy" || value === "community";
}

export default function PoliciesScreen() {
  const { t } = useTranslation();
  const { document: param } = useLocalSearchParams<{ document?: string }>();
  const document = isPolicyDocument(param) ? param : "terms";

  return (
    <Screen
      title={t(`policies.${document}.title`)}
      description={t(`policies.${document}.body`)}
    >
      <ErrorNotice>{t("policies.developmentWarning")}</ErrorNotice>
      <ErrorNotice>
        {t("policies.version", { version: POLICY_VERSIONS.terms })}
      </ErrorNotice>
      {document !== "terms" ? (
        <SecondaryButton
          label={t("policies.terms.title")}
          onPress={() => router.replace("/policies?document=terms")}
        />
      ) : null}
      {document !== "privacy" ? (
        <SecondaryButton
          label={t("policies.privacy.title")}
          onPress={() => router.replace("/policies?document=privacy")}
        />
      ) : null}
      {document !== "community" ? (
        <SecondaryButton
          label={t("policies.community.title")}
          onPress={() => router.replace("/policies?document=community")}
        />
      ) : null}
      <PrimaryButton label={t("common.back")} onPress={() => router.back()} />
    </Screen>
  );
}
