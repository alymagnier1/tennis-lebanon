import { describe, expect, it } from "vitest";
import {
  homeFirstPlayKind,
  shouldShowHomeFirstPlayEmpty,
} from "./home-first-play";

const readyEmpty = {
  hasHeroAction: false,
  upcomingCount: 0,
  openMatchCount: 0,
  freeSlotCount: 0,
  openMatchesReady: true,
  freeSlotsReady: true,
  availabilityReady: true,
  openMatchesFailed: false,
  freeSlotsFailed: false,
  availabilityFailed: false,
};

describe("homeFirstPlayKind", () => {
  it("asks to organise when Home has nothing to list and no next action", () => {
    expect(homeFirstPlayKind(readyEmpty)).toBe("play");
    expect(shouldShowHomeFirstPlayEmpty(readyEmpty)).toBe(true);
  });

  it("waits until liquidity and availability queries finish", () => {
    expect(
      homeFirstPlayKind({
        ...readyEmpty,
        openMatchesReady: false,
      }),
    ).toBeNull();
    expect(
      homeFirstPlayKind({
        ...readyEmpty,
        availabilityReady: false,
      }),
    ).toBeNull();
  });

  it("does not stack over a next action, listing, or query failure", () => {
    expect(
      homeFirstPlayKind({ ...readyEmpty, hasHeroAction: true }),
    ).toBeNull();
    expect(homeFirstPlayKind({ ...readyEmpty, openMatchCount: 2 })).toBeNull();
    expect(homeFirstPlayKind({ ...readyEmpty, freeSlotCount: 1 })).toBeNull();
    expect(homeFirstPlayKind({ ...readyEmpty, upcomingCount: 1 })).toBeNull();
    expect(
      homeFirstPlayKind({ ...readyEmpty, openMatchesFailed: true }),
    ).toBeNull();
  });

  it("still offers organise when availability cannot load", () => {
    expect(homeFirstPlayKind({ ...readyEmpty, availabilityFailed: true })).toBe(
      "play",
    );
  });
});
