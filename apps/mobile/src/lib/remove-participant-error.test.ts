import { describe, expect, it } from "vitest";
import { removeParticipantErrorKey } from "./remove-participant-error";

describe("removeParticipantErrorKey", () => {
  it("names a match that has already started", () => {
    expect(removeParticipantErrorKey(new Error("match_already_started"))).toBe(
      "matches.hub.removeErrorStarted",
    );
  });

  it("names a player who is not on the roster", () => {
    expect(
      removeParticipantErrorKey({ message: "P0001: participant_not_accepted" }),
    ).toBe("matches.hub.removeErrorNotAccepted");
  });

  it("falls back to the generic key", () => {
    expect(removeParticipantErrorKey(new Error("cannot_remove_self"))).toBe(
      "matches.hub.removeError",
    );
    expect(removeParticipantErrorKey(null)).toBe("matches.hub.removeError");
  });
});
