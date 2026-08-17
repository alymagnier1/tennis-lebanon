import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordClientEvent = vi.fn();

// Mock the leaves, not `./analytics` itself: importActual on that module pulls in
// the real `./supabase`, which loads react-native, which is Flow-typed and cannot
// be parsed by the test transformer. Mocking here keeps the real
// trackCreateStep -> trackEvent -> recordClientEvent chain under test.
vi.mock("@tennis-lebanon/api", () => ({
  recordClientEvent: (...args: unknown[]) => recordClientEvent(...args),
}));

vi.mock("./supabase", () => ({ supabase: { __client: true } }));

const {
  __resetCreateFlowTrackingForTest,
  beginCreateFlowTracking,
  markCreateFlowPublished,
  trackCreateFlowExit,
  trackCreateStep,
  trackRematchPublished,
} = await import("./create-flow-analytics");

function emitted(): { event: string; props: unknown }[] {
  return recordClientEvent.mock.calls.map((call) => ({
    event: call[1] as string,
    props: call[2],
  }));
}

beforeEach(() => {
  recordClientEvent.mockReset();
  recordClientEvent.mockResolvedValue(undefined);
  __resetCreateFlowTrackingForTest();
});

afterEach(() => {
  __resetCreateFlowTrackingForTest();
});

describe("trackCreateStep", () => {
  it("records a real step", () => {
    trackCreateStep("/match/create/schedule");
    expect(emitted()).toEqual([
      { event: "create_step_viewed", props: { step: "schedule" } },
    ]);
  });

  it("ignores the loader, which redirects and is never seen", () => {
    // expo-router reports the index route as `/match/create`, so this is the
    // shape that actually occurs at runtime — it was recording a phantom step
    // called `create` until the check matched on the path instead of the slug.
    for (const path of [
      "/match/create",
      "/match/create/",
      "/match/create/index",
      "/match/create/index/",
    ]) {
      trackCreateStep(path);
    }

    expect(emitted()).toEqual([]);
  });

  it("ignores a path that yields no valid slug", () => {
    trackCreateStep("/match/create/123");
    expect(emitted()).toEqual([]);
  });
});

describe("create_abandoned", () => {
  it("fires with the last step when the host leaves without publishing", () => {
    beginCreateFlowTracking();
    trackCreateStep("/match/create/schedule");
    trackCreateStep("/match/create/details");
    recordClientEvent.mockClear();

    trackCreateFlowExit();

    expect(emitted()).toEqual([
      { event: "create_abandoned", props: { step: "details" } },
    ]);
  });

  it("does not fire after a successful publish", () => {
    beginCreateFlowTracking();
    trackCreateStep("/match/create/schedule");
    markCreateFlowPublished();
    recordClientEvent.mockClear();

    trackCreateFlowExit();

    expect(emitted()).toEqual([]);
  });

  it("does not fire when no real step was ever reached", () => {
    beginCreateFlowTracking();
    trackCreateStep("/match/create/index");
    recordClientEvent.mockClear();

    trackCreateFlowExit();

    expect(emitted()).toEqual([]);
  });

  it("does not leak a prior flow into the next one", () => {
    beginCreateFlowTracking();
    trackCreateStep("/match/create/schedule");
    trackCreateFlowExit();
    recordClientEvent.mockClear();

    // Second flow: opened and closed without reaching a step.
    beginCreateFlowTracking();
    trackCreateFlowExit();

    expect(emitted()).toEqual([]);
  });

  it("does not double-report if exit runs twice", () => {
    beginCreateFlowTracking();
    trackCreateStep("/match/create/schedule");
    recordClientEvent.mockClear();

    trackCreateFlowExit();
    trackCreateFlowExit();

    expect(emitted()).toEqual([
      { event: "create_abandoned", props: { step: "schedule" } },
    ]);
  });
});

describe("trackRematchPublished", () => {
  it("emits with the surface the rematch came from", () => {
    trackRematchPublished("completed_list");
    expect(emitted()).toEqual([
      { event: "rematch_published", props: { surface: "completed_list" } },
    ]);
  });

  it("stays silent for a draft that did not come from a rematch", () => {
    trackRematchPublished(undefined);
    expect(emitted()).toEqual([]);
  });
});
