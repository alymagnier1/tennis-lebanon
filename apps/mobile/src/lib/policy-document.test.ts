import { describe, expect, it } from "vitest";
import { isPolicyDocumentId, readPolicySections } from "./policy-document";

describe("policy-document", () => {
  it("accepts only known document ids", () => {
    expect(isPolicyDocumentId("privacy")).toBe(true);
    expect(isPolicyDocumentId("terms")).toBe(true);
    expect(isPolicyDocumentId("community")).toBe(true);
    expect(isPolicyDocumentId("cookies")).toBe(false);
    expect(isPolicyDocumentId(undefined)).toBe(false);
  });

  it("reads section objects from i18n returnObjects", () => {
    const t = ((key: string, options?: { returnObjects?: boolean }) => {
      if (key === "policies.terms.sections" && options?.returnObjects) {
        return [
          { heading: "1. Pilot", body: "Adults only." },
          { heading: "broken" },
          null,
        ];
      }
      return key;
    }) as never;

    expect(readPolicySections(t, "terms")).toEqual([
      { heading: "1. Pilot", body: "Adults only." },
    ]);
  });
});
