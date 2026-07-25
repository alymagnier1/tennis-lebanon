import { describe, expect, it } from "vitest";
import { deriveAccessState } from "./access-state";

describe("deriveAccessState", () => {
  it("keeps anonymous and restoring sessions outside protected routes", () => {
    expect(deriveAccessState(false, null, false, false)).toBe("anonymous");
    expect(deriveAccessState(true, null, true, false)).toBe("loading");
  });

  it("routes incomplete profiles to onboarding", () => {
    expect(
      deriveAccessState(
        true,
        { account_status: "active", onboarding_completed_at: null },
        false,
        false,
      ),
    ).toBe("needsOnboarding");
  });

  it("blocks suspended and deletion-requested profiles", () => {
    expect(
      deriveAccessState(
        true,
        {
          account_status: "suspended",
          onboarding_completed_at: "2026-07-25T00:00:00Z",
        },
        false,
        false,
      ),
    ).toBe("suspended");
    expect(
      deriveAccessState(
        true,
        {
          account_status: "deletion_requested",
          onboarding_completed_at: "2026-07-25T00:00:00Z",
        },
        false,
        false,
      ),
    ).toBe("deletionRequested");
  });

  it("allows only complete active profiles into tabs", () => {
    expect(
      deriveAccessState(
        true,
        {
          account_status: "active",
          onboarding_completed_at: "2026-07-25T00:00:00Z",
        },
        false,
        false,
      ),
    ).toBe("ready");
  });
});
