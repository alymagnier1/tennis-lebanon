import { describe, expect, it } from "vitest";
import {
  activeHostedContinueRoute,
  findAnyActiveHostedMatch,
  shouldResumeDraftHostedMatch,
} from "./create-match-guard.logic";

describe("findAnyActiveHostedMatch", () => {
  it("returns the first active hosted match across formats", () => {
    const matches = [
      {
        match_id: "singles-1",
        format: "singles",
        status: "open",
        is_creator: true,
      },
      {
        match_id: "doubles-1",
        format: "doubles",
        status: "open",
        is_creator: true,
      },
    ] as const;

    expect(findAnyActiveHostedMatch([...matches] as never)?.matchId).toBe(
      "singles-1",
    );
  });

  it("returns undefined when no active hosted match exists", () => {
    expect(
      findAnyActiveHostedMatch([
        {
          match_id: "done",
          format: "singles",
          status: "completed",
          is_creator: true,
        },
      ] as never),
    ).toBeUndefined();
  });

  it("returns draft hosted matches", () => {
    expect(
      findAnyActiveHostedMatch([
        {
          match_id: "draft-1",
          format: "singles",
          status: "draft",
          is_creator: true,
        },
      ] as never),
    ).toEqual({
      matchId: "draft-1",
      format: "singles",
      status: "draft",
    });
  });
});

describe("shouldResumeDraftHostedMatch", () => {
  it("returns true only for draft listings", () => {
    expect(
      shouldResumeDraftHostedMatch({
        matchId: "m1",
        format: "singles",
        status: "draft",
      }),
    ).toBe(true);
    expect(
      shouldResumeDraftHostedMatch({
        matchId: "m1",
        format: "singles",
        status: "open",
      }),
    ).toBe(false);
  });
});

describe("activeHostedContinueRoute", () => {
  it("routes draft matches to invite", () => {
    expect(
      activeHostedContinueRoute({
        matchId: "m1",
        format: "singles",
        status: "draft",
      }),
    ).toEqual({
      pathname: "/match/[id]/invite",
      params: { id: "m1" },
    });
  });

  it("routes published matches to hub", () => {
    expect(
      activeHostedContinueRoute({
        matchId: "m1",
        format: "singles",
        status: "open",
      }),
    ).toEqual({
      pathname: "/match/[id]",
      params: { id: "m1" },
    });
  });
});
