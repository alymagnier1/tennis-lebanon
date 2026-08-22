import { describe, expect, it } from "vitest";
import { availabilitySelectionChanged } from "./availability-selection";

const set = (...cells: string[]) => new Set(cells);

describe("availabilitySelectionChanged", () => {
  it("is unchanged when both are empty", () => {
    expect(availabilitySelectionChanged(set(), set())).toBe(false);
  });

  it("is unchanged when the same cells are selected in any order", () => {
    expect(
      availabilitySelectionChanged(
        set("1-evening", "3-morning"),
        set("3-morning", "1-evening"),
      ),
    ).toBe(false);
  });

  it("notices an added cell", () => {
    expect(
      availabilitySelectionChanged(
        set("1-evening", "2-evening"),
        set("1-evening"),
      ),
    ).toBe(true);
  });

  it("notices a removed cell", () => {
    expect(
      availabilitySelectionChanged(
        set("1-evening"),
        set("1-evening", "2-evening"),
      ),
    ).toBe(true);
  });

  it("notices a swap that keeps the count the same", () => {
    // Size alone would call this unchanged, which is the case worth guarding.
    expect(
      availabilitySelectionChanged(set("1-evening"), set("2-evening")),
    ).toBe(true);
  });

  it("treats toggling a cell off again as no change", () => {
    // Local state is populated here, but nothing actually differs, so Save
    // would write exactly what is already stored.
    const saved = set("1-evening");
    const touchedThenReverted = set("1-evening");
    expect(availabilitySelectionChanged(touchedThenReverted, saved)).toBe(
      false,
    );
  });
});
