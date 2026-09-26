import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agreedTimeConflictsQueryOptions } from "./agreed-time-conflicts-query";

const WINDOW = {
  startsAt: "2030-01-15T16:00:00.000Z",
  endsAt: "2030-01-15T17:30:00.000Z",
};
const A_CONFLICT = {
  match_id: "player-a-private-match",
  starts_at: WINDOW.startsAt,
  ends_at: WINDOW.endsAt,
};

describe("agreedTimeConflictsQueryOptions", () => {
  const client = new QueryClient();
  afterEach(() => client.clear());

  it("never serves one account's cached conflict to another (account switch)", async () => {
    // Reproduces the 2026-09-26 recheck with the real query client: A checks a
    // slot, signs out, B signs in on the same running app and checks the same
    // slot within the freshness window.
    const fetchForA = vi.fn(async () => [A_CONFLICT]);
    const a = await client.fetchQuery(
      agreedTimeConflictsQueryOptions({
        userId: "user-a",
        window: WINDOW,
        fetchConflicts: fetchForA,
      }),
    );
    expect(a).toEqual([A_CONFLICT]);

    const fetchForB = vi.fn(async () => []);
    const b = await client.fetchQuery(
      agreedTimeConflictsQueryOptions({
        userId: "user-b",
        window: WINDOW,
        fetchConflicts: fetchForB,
      }),
    );

    expect(fetchForB).toHaveBeenCalledOnce();
    expect(b).toEqual([]);
  });

  it("still reuses the same account's fresh answer for the same slot", async () => {
    const fetchConflicts = vi.fn(async () => [A_CONFLICT]);
    const options = agreedTimeConflictsQueryOptions({
      userId: "user-a",
      window: WINDOW,
      fetchConflicts,
    });

    await client.fetchQuery(options);
    await client.fetchQuery(options);

    expect(fetchConflicts).toHaveBeenCalledOnce();
  });

  it("is disabled without a signed-in user or a slot", () => {
    const fetchConflicts = vi.fn(async () => []);
    expect(
      agreedTimeConflictsQueryOptions({
        userId: null,
        window: WINDOW,
        fetchConflicts,
      }).enabled,
    ).toBe(false);
    expect(
      agreedTimeConflictsQueryOptions({
        userId: "user-a",
        window: null,
        fetchConflicts,
      }).enabled,
    ).toBe(false);
  });

  it("keys the query by account and window", () => {
    const fetchConflicts = vi.fn(async () => []);
    expect(
      agreedTimeConflictsQueryOptions({
        userId: "user-a",
        window: WINDOW,
        fetchConflicts,
      }).queryKey,
    ).toEqual([
      "agreed-time-conflicts",
      "user-a",
      WINDOW.startsAt,
      WINDOW.endsAt,
    ]);
  });
});
