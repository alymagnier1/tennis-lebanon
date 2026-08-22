import { describe, expect, it } from "vitest";
import { autoSelectedZoneIds } from "./onboarding-zone-autoselect";

describe("autoSelectedZoneIds", () => {
  it("selects the only zone the pilot ships", () => {
    expect(
      autoSelectedZoneIds({
        availableZoneIds: ["zone-beirut"],
        selectedZoneIds: [],
      }),
    ).toEqual(["zone-beirut"]);
  });

  it("leaves a real choice to the player", () => {
    expect(
      autoSelectedZoneIds({
        availableZoneIds: ["zone-beirut", "zone-tripoli"],
        selectedZoneIds: [],
      }),
    ).toBeNull();
  });

  it("never overwrites a selection the player already made", () => {
    // Coming back to the step must not silently re-add a zone they removed.
    expect(
      autoSelectedZoneIds({
        availableZoneIds: ["zone-beirut"],
        selectedZoneIds: ["zone-beirut"],
      }),
    ).toBeNull();
  });

  it("does nothing before the zones have loaded", () => {
    expect(
      autoSelectedZoneIds({ availableZoneIds: [], selectedZoneIds: [] }),
    ).toBeNull();
  });
});
