import { describe, expect, it } from "vitest";
import { PILOT_CRITICAL_FLOWS } from "./critical-flows";
import { PILOT_WORKFLOW_REHEARSALS } from "./pilot-workflows";

describe("pilot workflow rehearsals", () => {
  it("defines five partner-club workflows for pilot exit", () => {
    expect(PILOT_WORKFLOW_REHEARSALS).toHaveLength(5);
    expect(new Set(PILOT_WORKFLOW_REHEARSALS.map((row) => row.id)).size).toBe(
      5,
    );
  });

  it("maps rehearsals to known critical flows", () => {
    for (const rehearsal of PILOT_WORKFLOW_REHEARSALS) {
      for (const flow of rehearsal.criticalFlows) {
        expect(PILOT_CRITICAL_FLOWS).toContain(flow);
      }
    }
  });
});
