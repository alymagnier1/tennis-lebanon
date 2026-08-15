import { describe, expect, it } from "vitest";
import {
  acceptedHubParticipants,
  matchHubReadyChips,
  pickHubVsSides,
} from "./match-hub-ready-hero";

const host = {
  user_id: "a",
  display_name: "Player A",
  status: "accepted",
  is_creator: true,
};
const guest = {
  user_id: "b",
  display_name: "Player B",
  status: "accepted",
  is_creator: false,
};
const invited = {
  user_id: "c",
  display_name: "Player C",
  status: "invited",
  is_creator: false,
};

describe("acceptedHubParticipants", () => {
  it("keeps accepted only and sorts host first", () => {
    expect(acceptedHubParticipants([guest, invited, host])).toEqual([
      host,
      guest,
    ]);
  });
});

describe("pickHubVsSides", () => {
  it("splits singles into 1v1", () => {
    expect(pickHubVsSides([host, guest], 2)).toEqual({
      left: [host],
      right: [guest],
      leftOpen: 0,
      rightOpen: 0,
    });
  });

  it("shows an open slot when opponent is missing", () => {
    expect(pickHubVsSides([host], 2)).toEqual({
      left: [host],
      right: [],
      leftOpen: 0,
      rightOpen: 1,
    });
  });

  it("splits doubles into 2v2", () => {
    const c = { ...guest, user_id: "c", display_name: "C" };
    const d = { ...guest, user_id: "d", display_name: "D" };
    expect(pickHubVsSides([host, guest, c, d], 4)).toEqual({
      left: [host, guest],
      right: [c, d],
      leftOpen: 0,
      rightOpen: 0,
    });
  });
});

describe("matchHubReadyChips", () => {
  it("returns format, intent, and level", () => {
    const t = (key: string) => key;
    expect(
      matchHubReadyChips(
        {
          format: "singles",
          intent: "competitive",
          min_skill: "intermediate",
          max_skill: "intermediate",
        },
        t,
      ),
    ).toEqual([
      "formats.singles",
      "playIntent.competitive",
      "skillBandsShort.intermediate",
    ]);
  });
});
