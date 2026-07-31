import { describe, expect, it } from "vitest";
import { PILOT_CRITICAL_FLOWS, isPilotCriticalFlow } from "./critical-flows";

describe("pilot critical flows", () => {
  it("lists unique release-review flows", () => {
    expect(PILOT_CRITICAL_FLOWS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(PILOT_CRITICAL_FLOWS).size).toBe(
      PILOT_CRITICAL_FLOWS.length,
    );
  });

  it("recognises known flow ids", () => {
    expect(isPilotCriticalFlow("match.hub")).toBe(true);
    expect(isPilotCriticalFlow("unknown.flow")).toBe(false);
  });
});
