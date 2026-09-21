import type { TFunction } from "i18next";
import {
  POLICY_DOCUMENT_IDS,
  type PolicyDocumentId,
  type PolicySection,
} from "@tennis-lebanon/i18n";

export function isPolicyDocumentId(value: unknown): value is PolicyDocumentId {
  return (
    typeof value === "string" &&
    (POLICY_DOCUMENT_IDS as readonly string[]).includes(value)
  );
}

export function readPolicySections(
  t: TFunction,
  document: PolicyDocumentId,
): PolicySection[] {
  const raw = t(`policies.${document}.sections`, {
    returnObjects: true,
  });

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as PolicySection).heading !== "string" ||
      typeof (entry as PolicySection).body !== "string"
    ) {
      return [];
    }
    return [
      {
        heading: (entry as PolicySection).heading,
        body: (entry as PolicySection).body,
      },
    ];
  });
}
