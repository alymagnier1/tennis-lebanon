import { describe, expect, it } from "vitest";
import {
  buildMatchCardHeadline,
  matchCardOpponentLabel,
  resolveMatchCardOpponent,
} from "./match-card-headline";

const translate = (key: string, options?: { name: string }) => {
  switch (key) {
    case "matches.list.youVsOpponent":
      return `You vs ${options?.name}`;
    case "matches.list.seekingOpponent":
      return "Looking for players";
    case "playerProfile.unknownOpponent":
      return "Opponent";
    default:
      return key;
  }
};

const baseInput = {
  status: "open",
  participantCount: 1,
  capacity: 2,
};

describe("matchCardOpponentLabel", () => {
  it("returns trimmed opponent names", () => {
    expect(matchCardOpponentLabel(" Karim Nassar ")).toBe("Karim Nassar");
  });

  it("returns undefined for empty values", () => {
    expect(matchCardOpponentLabel(null)).toBeUndefined();
    expect(matchCardOpponentLabel("   ")).toBeUndefined();
  });
});

describe("resolveMatchCardOpponent", () => {
  it("returns the named opponent when available", () => {
    expect(
      resolveMatchCardOpponent(translate, {
        ...baseInput,
        opponentNames: "Player B",
      }),
    ).toBe("Player B");
  });

  it("returns a placeholder when the roster is full but names are missing", () => {
    expect(
      resolveMatchCardOpponent(translate, {
        status: "confirmed",
        participantCount: 2,
        capacity: 2,
        opponentNames: null,
      }),
    ).toBe("Opponent");
  });
});

describe("buildMatchCardHeadline", () => {
  it("builds a you-vs headline when an opponent exists", () => {
    expect(
      buildMatchCardHeadline(translate, {
        ...baseInput,
        opponentNames: "Karim Nassar",
      }),
    ).toBe("You vs Karim Nassar");
  });

  it("does not claim to seek players on a confirmed full roster", () => {
    expect(
      buildMatchCardHeadline(translate, {
        status: "confirmed",
        participantCount: 2,
        capacity: 2,
        opponentNames: null,
      }),
    ).toBe("You vs Opponent");
  });

  it("shows seeking copy only while recruiting", () => {
    expect(
      buildMatchCardHeadline(translate, {
        status: "open",
        participantCount: 1,
        capacity: 2,
        opponentNames: null,
      }),
    ).toBe("Looking for players");
  });
});
