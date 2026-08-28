import { describe, expect, it } from "vitest";
import type { OpenMatchCard } from "@tennis-lebanon/api";
import { completeGiftState } from "./complete-gift-state";

const listing = { match_id: "m1" } as OpenMatchCard;

describe("completeGiftState", () => {
  it("waits before claiming emptiness or listings", () => {
    expect(
      completeGiftState({ isPending: true, isError: false, matches: [] }),
    ).toEqual({ kind: "pending" });
  });

  it("reports the failure rather than listing stale matches", () => {
    expect(
      completeGiftState({
        isPending: false,
        isError: true,
        matches: [listing],
      }),
    ).toEqual({ kind: "error" });
  });

  it("shows overlapping listings when they exist", () => {
    expect(
      completeGiftState({
        isPending: false,
        isError: false,
        matches: [listing],
      }),
    ).toEqual({ kind: "listings", matches: [listing] });
  });

  it("uses the organise empty, not a nobody-is-here claim", () => {
    expect(
      completeGiftState({ isPending: false, isError: false, matches: [] }),
    ).toEqual({ kind: "empty" });
  });
});
