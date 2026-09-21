export type {
  PoliciesCopy,
  PolicyDocumentCopy,
  PolicyDocumentId,
  PolicySection,
} from "./types";
export { POLICY_DOCUMENT_IDS } from "./types";
export { policiesEn } from "./en";
export { policiesAr } from "./ar";
export { policiesFr } from "./fr";

import type { PoliciesCopy } from "./types";
import { policiesAr } from "./ar";
import { policiesEn } from "./en";
import { policiesFr } from "./fr";

export const policyLocaleBundles = {
  en: policiesEn,
  ar: policiesAr,
  fr: policiesFr,
} as const satisfies Record<"en" | "ar" | "fr", PoliciesCopy>;
