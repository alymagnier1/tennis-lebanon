import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverCompatiblePlayers, discoverOpenMatches } from "./discovery";
import type { TennisSupabaseClient } from "./client";

function createMockClient() {
  const rpc = vi.fn();
  const client = { rpc } as unknown as TennisSupabaseClient;
  return { client, rpc };
}

describe("discovery API wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps compatible player filters to the RPC", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: [], error: null });

    await discoverCompatiblePlayers(client, {
      zoneIds: ["aaaaaaaa-0001-0001-0001-000000000001"],
      format: "singles",
      intent: "social",
      requireAvailabilityOverlap: false,
      horizonDays: 7,
      levelWindow: 2,
      limit: 10,
    });

    expect(rpc).toHaveBeenCalledWith("discover_compatible_players", {
      p_zone_ids: ["aaaaaaaa-0001-0001-0001-000000000001"],
      p_format: "singles",
      p_intent: "social",
      p_require_availability_overlap: false,
      p_horizon_days: 7,
      p_level_window: 2,
      p_limit: 10,
      p_cursor_user_id: undefined,
    });
  });

  it("throws when compatible player discovery fails", async () => {
    const { client, rpc } = createMockClient();
    const rpcError = { message: "discovery_rate_limited", code: "P0001" };
    rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(discoverCompatiblePlayers(client)).rejects.toEqual(rpcError);
  });

  it("maps open match filters to the RPC", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: [], error: null });

    await discoverOpenMatches(
      client,
      { format: "doubles", horizonDays: 14 },
      "2026-07-25T10:00:00.000Z",
    );

    expect(rpc).toHaveBeenCalledWith("discover_open_matches", {
      p_zone_ids: undefined,
      p_format: "doubles",
      p_intent: undefined,
      p_horizon_days: 14,
      p_limit: 20,
      p_cursor_created_at: "2026-07-25T10:00:00.000Z",
    });
  });
});
