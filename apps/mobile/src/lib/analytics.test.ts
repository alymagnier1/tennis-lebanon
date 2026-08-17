import { afterEach, describe, expect, it, vi } from "vitest";

const recordClientEvent = vi.fn();

vi.mock("@tennis-lebanon/api", () => ({
  recordClientEvent: (...args: unknown[]) => recordClientEvent(...args),
}));

vi.mock("./supabase", () => ({ supabase: { __client: true } }));

const {
  routeStepSlug,
  trackDiscoverViewed,
  trackEvent,
  trackOnboardingStep,
  trackRematch,
} = await import("./analytics");

afterEach(() => {
  recordClientEvent.mockReset();
});

describe("trackEvent", () => {
  it("forwards the event and props", () => {
    recordClientEvent.mockResolvedValue(undefined);
    trackEvent("create_abandoned", { step: "schedule" });

    expect(recordClientEvent).toHaveBeenCalledWith(
      { __client: true },
      "create_abandoned",
      { step: "schedule" },
    );
  });

  it("swallows a rejection rather than surfacing it to a player", async () => {
    recordClientEvent.mockRejectedValue(new Error("network down"));

    expect(() => trackEvent("discover_viewed")).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("defaults props to an empty object", () => {
    recordClientEvent.mockResolvedValue(undefined);
    trackEvent("onboarding_step_viewed");

    expect(recordClientEvent).toHaveBeenCalledWith(
      expect.anything(),
      "onboarding_step_viewed",
      {},
    );
  });
});

describe("trackDiscoverViewed", () => {
  it("derives is_empty from the result count", () => {
    recordClientEvent.mockResolvedValue(undefined);

    trackDiscoverViewed({
      segment: "players",
      resultCount: 0,
      filtersActive: 3,
    });
    expect(recordClientEvent).toHaveBeenLastCalledWith(
      expect.anything(),
      "discover_viewed",
      {
        segment: "players",
        result_count: 0,
        filters_active: 3,
        is_empty: true,
      },
    );

    trackDiscoverViewed({
      segment: "matches",
      resultCount: 7,
      filtersActive: 0,
    });
    expect(recordClientEvent).toHaveBeenLastCalledWith(
      expect.anything(),
      "discover_viewed",
      {
        segment: "matches",
        result_count: 7,
        filters_active: 0,
        is_empty: false,
      },
    );
  });
});

describe("routeStepSlug", () => {
  it("takes the last segment and snake_cases it", () => {
    expect(routeStepSlug("/tennis-profile")).toBe("tennis_profile");
    expect(routeStepSlug("/(onboarding)/zones")).toBe("zones");
    expect(routeStepSlug("enable-notifications")).toBe("enable_notifications");
  });

  it("returns null rather than an invalid token", () => {
    // The SQL allowlist requires a leading letter, so these must not be sent.
    expect(routeStepSlug("/123")).toBeNull();
    expect(routeStepSlug("/")).toBeNull();
    expect(routeStepSlug("")).toBeNull();
    expect(routeStepSlug(null)).toBeNull();
    expect(routeStepSlug(undefined)).toBeNull();
    expect(routeStepSlug("/---")).toBeNull();
  });

  it("produces a token the SQL allowlist accepts", () => {
    const slug = routeStepSlug(
      "/A-Very-Long-Onboarding-Step-Name-That-Overflows",
    );
    expect(slug).not.toBeNull();
    expect(slug!).toMatch(/^[a-z][a-z0-9_]{0,31}$/);
  });
});

describe("trackOnboardingStep", () => {
  it("sends the derived step and index", () => {
    recordClientEvent.mockResolvedValue(undefined);
    trackOnboardingStep("/(onboarding)/zones", 3);

    expect(recordClientEvent).toHaveBeenCalledWith(
      expect.anything(),
      "onboarding_step_viewed",
      { step: "zones", step_index: 3 },
    );
  });

  it("sends nothing when the route yields no valid slug", () => {
    recordClientEvent.mockResolvedValue(undefined);
    trackOnboardingStep("/123", 1);

    expect(recordClientEvent).not.toHaveBeenCalled();
  });

  it("omits step_index when not given", () => {
    recordClientEvent.mockResolvedValue(undefined);
    trackOnboardingStep("/consent");

    expect(recordClientEvent).toHaveBeenCalledWith(
      expect.anything(),
      "onboarding_step_viewed",
      { step: "consent" },
    );
  });
});

describe("trackRematch", () => {
  it("builds the staged event name and carries the surface", () => {
    recordClientEvent.mockResolvedValue(undefined);
    trackRematch("started", { surface: "completed_list" });

    expect(recordClientEvent).toHaveBeenCalledWith(
      expect.anything(),
      "rematch_started",
      { surface: "completed_list" },
    );
  });

  it("omits opponent_count when not supplied, rather than sending undefined", () => {
    recordClientEvent.mockResolvedValue(undefined);
    trackRematch("offered", { surface: "hub" });

    expect(recordClientEvent).toHaveBeenCalledWith(
      expect.anything(),
      "rematch_offered",
      { surface: "hub" },
    );
  });

  it("includes opponent_count when supplied, including zero", () => {
    recordClientEvent.mockResolvedValue(undefined);
    trackRematch("published", { surface: "home", opponentCount: 0 });

    expect(recordClientEvent).toHaveBeenCalledWith(
      expect.anything(),
      "rematch_published",
      { surface: "home", opponent_count: 0 },
    );
  });
});
