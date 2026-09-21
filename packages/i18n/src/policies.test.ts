import { describe, expect, it } from "vitest";
import { POLICY_DOCUMENT_IDS, policyLocaleBundles, resources } from "./index";

describe("policy drafts", () => {
  it("keeps the same section shape across locales", () => {
    for (const document of POLICY_DOCUMENT_IDS) {
      const enSections = policyLocaleBundles.en[document].sections;
      expect(policyLocaleBundles.ar[document].sections).toHaveLength(
        enSections.length,
      );
      expect(policyLocaleBundles.fr[document].sections).toHaveLength(
        enSections.length,
      );
      expect(enSections.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("merges drafts into i18n resources", () => {
    const en = resources.en.translation as {
      policies: { terms: { summary: string; sections: unknown[] } };
    };
    expect(en.policies.terms.summary.length).toBeGreaterThan(20);
    expect(en.policies.terms.sections.length).toBeGreaterThan(0);
  });
});
