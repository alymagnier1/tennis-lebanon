import { describe, expect, it } from "vitest";
import {
  isBenignPrelaunchConflict,
  isPrelaunchRateLimited,
  normalizePrelaunchPhone,
  parsePrelaunchSignup,
  PRELAUNCH_CONSENT_VERSION,
} from "./prelaunch-signup";

const KEY = "11111111-1111-4111-8111-111111111111";

function body(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Rami",
    channel: "whatsapp",
    contact: "71 123 456",
    level: "intermediate",
    court: "Hamra",
    availability: ["wd-ev", "we-am"],
    adultAndContactConsent: true,
    community: "beirut",
    consentVersion: PRELAUNCH_CONSENT_VERSION,
    idempotencyKey: KEY,
    ...overrides,
  };
}

describe("normalizePrelaunchPhone", () => {
  it("assumes Lebanon and accepts an explicit country code", () => {
    expect(normalizePrelaunchPhone("71 123 456")).toBe("+96171123456");
    expect(normalizePrelaunchPhone("071123456")).toBe("+96171123456");
    expect(normalizePrelaunchPhone("+961 71 123 456")).toBe("+96171123456");
    expect(normalizePrelaunchPhone("0096171123456")).toBe("+96171123456");
    expect(normalizePrelaunchPhone("96171123456")).toBe("+96171123456");
    expect(normalizePrelaunchPhone("+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("rejects a Lebanese number with the wrong length", () => {
    expect(normalizePrelaunchPhone("711234")).toBe("");
    expect(normalizePrelaunchPhone("+961711234567")).toBe("");
    expect(normalizePrelaunchPhone("123")).toBe("");
  });
});

describe("parsePrelaunchSignup", () => {
  it("normalizes a valid WhatsApp signup", () => {
    const parsed = parsePrelaunchSignup(body());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.row.contact).toBe("+96171123456");
    expect(parsed.row.court).toBe("Hamra");
    expect(parsed.row.availability).toEqual(["wd-ev", "we-am"]);
  });

  it("lowercases email and drops a blank court", () => {
    const parsed = parsePrelaunchSignup(
      body({ channel: "email", contact: " Rami@Example.com ", court: "  " }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.row.contact).toBe("rami@example.com");
    expect(parsed.row.court).toBeNull();
  });

  it("rejects a missing consent, an empty schedule, and a bad email", () => {
    expect(
      parsePrelaunchSignup(body({ adultAndContactConsent: false })).ok,
    ).toBe(false);
    expect(parsePrelaunchSignup(body({ availability: [] })).ok).toBe(false);
    expect(
      parsePrelaunchSignup(body({ channel: "email", contact: "not-an-email" }))
        .ok,
    ).toBe(false);
  });
});

describe("prelaunch conflicts and rate limit", () => {
  it("treats an idempotency replay as already recorded", () => {
    expect(
      isBenignPrelaunchConflict({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "prelaunch_signups_idempotency_key"',
      }),
    ).toBe(true);
  });

  it("treats a duplicate contact as already recorded", () => {
    expect(
      isBenignPrelaunchConflict({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "prelaunch_signups_community_contact"',
      }),
    ).toBe(true);
  });

  it("does not hide an unrelated database error", () => {
    expect(isBenignPrelaunchConflict({ code: "23502", message: "null" })).toBe(
      false,
    );
    expect(
      isBenignPrelaunchConflict({
        code: "23505",
        message: 'unique constraint "some_other_key"',
      }),
    ).toBe(false);
  });

  it("refuses the eighth attempt in the window", () => {
    expect(isPrelaunchRateLimited(7)).toBe(false);
    expect(isPrelaunchRateLimited(8)).toBe(true);
  });
});
