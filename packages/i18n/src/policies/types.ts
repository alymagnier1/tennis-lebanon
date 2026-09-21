export type PolicySection = {
  heading: string;
  body: string;
};

export type PolicyDocumentCopy = {
  title: string;
  /** One-line blurb for lists and the screen subtitle. */
  summary: string;
  intro: string;
  sections: PolicySection[];
};

export type PoliciesCopy = {
  developmentWarning: string;
  version: string;
  otherDocuments: string;
  terms: PolicyDocumentCopy;
  privacy: PolicyDocumentCopy;
  community: PolicyDocumentCopy;
};

export const POLICY_DOCUMENT_IDS = ["terms", "privacy", "community"] as const;
export type PolicyDocumentId = (typeof POLICY_DOCUMENT_IDS)[number];
