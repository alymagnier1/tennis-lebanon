import { describe, expect, it } from "vitest";
import {
  realtimeStatusFrom,
  shouldRefetchAfterStatusChange,
  type RealtimeStatus,
} from "./realtime-status";

describe("realtimeStatusFrom", () => {
  it("treats SUBSCRIBED as connected", () => {
    expect(realtimeStatusFrom("SUBSCRIBED")).toBe("connected");
  });

  it("treats every failure mode as interrupted", () => {
    expect(realtimeStatusFrom("CHANNEL_ERROR")).toBe("interrupted");
    expect(realtimeStatusFrom("TIMED_OUT")).toBe("interrupted");
    expect(realtimeStatusFrom("CLOSED")).toBe("interrupted");
  });

  it("treats anything unrecognised as still connecting", () => {
    expect(realtimeStatusFrom("SOMETHING_NEW")).toBe("connecting");
  });
});

describe("shouldRefetchAfterStatusChange", () => {
  it("refetches only on the recovery edge", () => {
    expect(shouldRefetchAfterStatusChange("interrupted", "connected")).toBe(
      true,
    );
  });

  it("does not refetch when the channel drops", () => {
    expect(shouldRefetchAfterStatusChange("connected", "interrupted")).toBe(
      false,
    );
  });

  it("does not refetch on the first successful subscribe", () => {
    // The initial fetch is the query's own job; refetching here would double
    // every open of the chat panel.
    expect(shouldRefetchAfterStatusChange("connecting", "connected")).toBe(
      false,
    );
  });

  it("does not refetch while still down", () => {
    expect(shouldRefetchAfterStatusChange("interrupted", "interrupted")).toBe(
      false,
    );
  });

  // The regression this whole module exists for: a drop and recovery must
  // trigger exactly one refetch, because no insert callback fires while the
  // channel is down and the transcript would otherwise stay stale.
  it("refetches exactly once across a full drop and recovery", () => {
    const events = ["SUBSCRIBED", "CHANNEL_ERROR", "CLOSED", "SUBSCRIBED"];
    let status: RealtimeStatus = "connecting";
    let refetches = 0;

    for (const event of events) {
      const next = realtimeStatusFrom(event);
      if (shouldRefetchAfterStatusChange(status, next)) {
        refetches += 1;
      }
      status = next;
    }

    expect(refetches).toBe(1);
    expect(status).toBe("connected");
  });
});
