import { describe, expect, it } from "vitest";
import { buildRematchContextCopy } from "./rematch-context-copy";

function context(
  overrides: Partial<
    Parameters<typeof buildRematchContextCopy>[0]["context"]
  > = {},
) {
  return {
    playedTogether: 3,
    viewerWins: 2,
    opponentWins: 1,
    viewerTotalCompleted: 8,
    ...overrides,
  };
}

function build(
  overrides: Partial<
    Parameters<typeof buildRematchContextCopy>[0]["context"]
  > = {},
  opponentName = "Rami",
) {
  return buildRematchContextCopy({ context: context(overrides), opponentName });
}

describe("milestone", () => {
  it("names the pair once they have played more than once", () => {
    expect(build().milestone).toEqual({
      key: "matches.rematch.milestoneWithPair",
      params: { total: 8, together: 3, name: "Rami" },
    });
  });

  it("drops the pair clause on a first meeting", () => {
    expect(build({ playedTogether: 1 }).milestone?.key).toBe(
      "matches.rematch.milestone",
    );
  });

  it("stays silent when the viewer has no completed matches at all", () => {
    // Nothing to celebrate, and "your 0th match" would be nonsense.
    expect(build({ viewerTotalCompleted: 0 }).milestone).toBeNull();
  });
});

describe("head to head", () => {
  it("claims a lead", () => {
    expect(build({ viewerWins: 2, opponentWins: 1 }).headToHead).toEqual({
      key: "matches.rematch.headToHeadLead",
      params: { wins: 2, losses: 1 },
    });
  });

  it("admits a deficit", () => {
    expect(build({ viewerWins: 1, opponentWins: 3 }).headToHead?.key).toBe(
      "matches.rematch.headToHeadTrail",
    );
  });

  it("reports level when the record is tied", () => {
    expect(build({ viewerWins: 2, opponentWins: 2 }).headToHead?.key).toBe(
      "matches.rematch.headToHeadLevel",
    );
  });

  it("says nothing when no result has been confirmed", () => {
    // The live seed data is exactly this: seven matches together, none decided.
    // A hollow "0-0" would read as a bug.
    const copy = build({
      playedTogether: 7,
      viewerWins: 0,
      opponentWins: 0,
      viewerTotalCompleted: 7,
    });

    expect(copy.headToHead).toBeNull();
    expect(copy.milestone?.params).toEqual({
      total: 7,
      together: 7,
      name: "Rami",
    });
  });

  it("shows a record even on a first meeting, if that one was decided", () => {
    const copy = build({
      playedTogether: 1,
      viewerWins: 1,
      opponentWins: 0,
      viewerTotalCompleted: 1,
    });

    expect(copy.milestone?.key).toBe("matches.rematch.milestone");
    expect(copy.headToHead?.key).toBe("matches.rematch.headToHeadLead");
  });
});
