import { describe, expect, it } from "vitest";
import {
  acceptedHubParticipants,
  hubOpenSpotCount,
  hubSlotDurationMinutes,
  pickHubSlotOccupant,
  pickHubVsSides,
  placeHubVsOccupant,
  shortPlayerLabel,
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

describe("pickHubSlotOccupant", () => {
  const sara = { user_id: "s" };
  const maya = { user_id: "m" };

  it("places the first requester when the queue fits the empty seats", () => {
    expect(pickHubSlotOccupant([sara], 1)).toEqual(sara);
    expect(pickHubSlotOccupant([sara, maya], 2)).toEqual(sara);
  });

  it("keeps the slot dashed when more people asked than seats remain", () => {
    expect(pickHubSlotOccupant([sara, maya], 1)).toBeNull();
  });

  it("returns null when nobody asked or the roster is full", () => {
    expect(pickHubSlotOccupant([], 1)).toBeNull();
    expect(pickHubSlotOccupant([sara], 0)).toBeNull();
  });
});

describe("placeHubVsOccupant", () => {
  it("puts the requester in the first empty seat on the right in singles", () => {
    const sides = pickHubVsSides([host], 2);
    expect(hubOpenSpotCount(sides)).toBe(1);
    expect(placeHubVsOccupant(sides, guest)).toEqual({
      left: [host],
      right: [],
      leftOpen: 0,
      rightOpen: 0,
      leftOccupant: null,
      rightOccupant: guest,
    });
  });
});

describe("shortPlayerLabel", () => {
  it("keeps the given name and the family initial", () => {
    expect(shortPlayerLabel("Rami Nassar")).toBe("Rami N.");
    expect(shortPlayerLabel("Ali Moghnieh")).toBe("Ali M.");
  });

  it("returns only the given name when there is no family name", () => {
    expect(shortPlayerLabel("Ali")).toBe("Ali");
    expect(shortPlayerLabel("")).toBe("");
  });
});

describe("hubSlotDurationMinutes", () => {
  it("rounds a 90-minute slot", () => {
    expect(
      hubSlotDurationMinutes(
        "2026-09-19T15:00:00.000Z",
        "2026-09-19T16:30:00.000Z",
      ),
    ).toBe(90);
  });

  it("returns null when either bound is missing or inverted", () => {
    expect(hubSlotDurationMinutes(null, "2026-09-19T16:30:00.000Z")).toBeNull();
    expect(
      hubSlotDurationMinutes(
        "2026-09-19T16:30:00.000Z",
        "2026-09-19T15:00:00.000Z",
      ),
    ).toBeNull();
  });
});
