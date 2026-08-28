import { describe, expect, it } from "vitest";
import { joinErrorKey } from "./join-error";

describe("joinErrorKey", () => {
  it("names the clashing hour, which the player can act on", () => {
    expect(joinErrorKey(new Error("match_time_conflict"))).toBe(
      "matches.hub.joinTimeConflict",
    );
  });

  it("names a full match", () => {
    expect(joinErrorKey(new Error("match_full"))).toBe("matches.hub.joinFull");
  });

  // Postgres wraps the message, so an exact match would miss every real error.
  it("matches inside a wrapped postgres message", () => {
    expect(
      joinErrorKey(new Error("P0001: match_time_conflict\nCONTEXT: PL/pgSQL")),
    ).toBe("matches.hub.joinTimeConflict");
  });

  it("falls back to the generic key for anything else", () => {
    expect(joinErrorKey(new Error("already_participant"))).toBe(
      "matches.hub.joinError",
    );
    expect(joinErrorKey(null)).toBe("matches.hub.joinError");
    expect(joinErrorKey("not an error")).toBe("matches.hub.joinError");
  });
});
