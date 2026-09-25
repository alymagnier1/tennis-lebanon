import { describe, expect, it, vi } from "vitest";
import {
  invalidateMatchChatSurfaces,
  matchIdFromMessageInsert,
} from "./match-chat-queries";

describe("matchIdFromMessageInsert", () => {
  it("reads match_id from a realtime insert payload", () => {
    expect(
      matchIdFromMessageInsert({ new: { match_id: "m1", body: "hi" } }),
    ).toBe("m1");
    expect(matchIdFromMessageInsert({ new: null })).toBeUndefined();
    expect(matchIdFromMessageInsert({ new: { body: "hi" } })).toBeUndefined();
  });
});

describe("invalidateMatchChatSurfaces", () => {
  it("invalidates my-matches and the match transcript", () => {
    const invalidateQueries = vi.fn();
    invalidateMatchChatSurfaces({ invalidateQueries } as never, "match-1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["my-matches"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["match-messages", "match-1"],
    });
  });

  it("invalidates all transcripts when match id is unknown", () => {
    const invalidateQueries = vi.fn();
    invalidateMatchChatSurfaces({ invalidateQueries } as never);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["match-messages"],
    });
  });
});
