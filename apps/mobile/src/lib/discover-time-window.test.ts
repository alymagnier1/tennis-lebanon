import { describe, expect, it } from "vitest";
import { parseDiscoverTimeWindow } from "./discover-time-window";

describe("parseDiscoverTimeWindow", () => {
  it("reads a valid window and normalises it to UTC", () => {
    expect(
      parseDiscoverTimeWindow({
        freeFrom: "2026-08-24T17:00:00.000Z",
        freeTo: "2026-08-24T22:00:00.000Z",
      }),
    ).toEqual({
      freeFrom: "2026-08-24T17:00:00.000Z",
      freeTo: "2026-08-24T22:00:00.000Z",
    });
  });

  it("normalises an offset time to the same instant in UTC", () => {
    // Beirut is +03:00 in summer, so this is the same moment as 17:00Z.
    expect(
      parseDiscoverTimeWindow({
        freeFrom: "2026-08-24T20:00:00+03:00",
        freeTo: "2026-08-25T01:00:00+03:00",
      }),
    ).toEqual({
      freeFrom: "2026-08-24T17:00:00.000Z",
      freeTo: "2026-08-24T22:00:00.000Z",
    });
  });

  it("returns null when either end is missing", () => {
    expect(parseDiscoverTimeWindow({})).toBeNull();
    expect(
      parseDiscoverTimeWindow({ freeFrom: "2026-08-24T17:00:00.000Z" }),
    ).toBeNull();
    expect(
      parseDiscoverTimeWindow({ freeTo: "2026-08-24T22:00:00.000Z" }),
    ).toBeNull();
  });

  it("returns null for values that are not dates", () => {
    expect(
      parseDiscoverTimeWindow({ freeFrom: "soon", freeTo: "later" }),
    ).toBeNull();
    expect(parseDiscoverTimeWindow({ freeFrom: "", freeTo: "" })).toBeNull();
  });

  it("returns null for an inverted or empty window", () => {
    // Would match nobody and read as broken rather than empty.
    expect(
      parseDiscoverTimeWindow({
        freeFrom: "2026-08-24T22:00:00.000Z",
        freeTo: "2026-08-24T17:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      parseDiscoverTimeWindow({
        freeFrom: "2026-08-24T17:00:00.000Z",
        freeTo: "2026-08-24T17:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("takes the first value when a param is duplicated", () => {
    // Expo Router hands back an array for a repeated key; a duplicated link is
    // merely untidy, not malformed.
    expect(
      parseDiscoverTimeWindow({
        freeFrom: ["2026-08-24T17:00:00.000Z", "2026-08-25T17:00:00.000Z"],
        freeTo: ["2026-08-24T22:00:00.000Z"],
      }),
    ).toEqual({
      freeFrom: "2026-08-24T17:00:00.000Z",
      freeTo: "2026-08-24T22:00:00.000Z",
    });
  });
});
