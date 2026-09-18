import { describe, expect, it } from "vitest";
import { joinErrorKey, respondRequestErrorKey } from "./join-error";

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

  // supabase-js rejects with a plain object, not an Error. An `instanceof`
  // check downgraded every real database failure to the generic copy, which
  // meant the two specific keys above were unreachable in the app.
  it("reads a bare PostgrestError object", () => {
    expect(joinErrorKey({ message: "match_full", code: "P0001" })).toBe(
      "matches.hub.joinFull",
    );
  });
});

describe("respondRequestErrorKey", () => {
  // The host's voice, not the joiner's: their own match is full, rather than
  // somebody else having got in first.
  it("names a full match in the host's voice", () => {
    expect(respondRequestErrorKey(new Error("match_full"))).toBe(
      "matches.hub.respondFull",
    );
    expect(respondRequestErrorKey({ message: "P0001: match_full" })).toBe(
      "matches.hub.respondFull",
    );
  });

  it("falls back to the generic key for anything else", () => {
    expect(respondRequestErrorKey(new Error("Join request not found"))).toBe(
      "matches.hub.respondError",
    );
    expect(respondRequestErrorKey(null)).toBe("matches.hub.respondError");
  });
});
