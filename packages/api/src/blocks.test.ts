import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockUser, unblockUser } from "./blocks";
import type { TennisSupabaseClient } from "./client";

function createMockClient() {
  const getUser = vi.fn();
  const insert = vi.fn();
  const deleteEq = vi.fn();
  const from = vi.fn();
  const client = {
    auth: { getUser },
    from,
  } as unknown as TennisSupabaseClient;

  from.mockReturnValue({
    insert,
    delete: vi.fn().mockReturnValue({
      eq: deleteEq.mockResolvedValue({ error: null }),
    }),
  });

  getUser.mockResolvedValue({
    data: { user: { id: "11111111-1111-1111-1111-111111111111" } },
    error: null,
  });
  insert.mockResolvedValue({ error: null });

  return { client, getUser, insert, deleteEq, from };
}

describe("blocks API wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks a user with the authenticated caller id", async () => {
    const { client, insert } = createMockClient();

    await blockUser(client, "22222222-2222-2222-2222-222222222222");

    expect(insert).toHaveBeenCalledWith({
      blocker_id: "11111111-1111-1111-1111-111111111111",
      blocked_id: "22222222-2222-2222-2222-222222222222",
    });
  });

  it("throws when blocking without an authenticated user", async () => {
    const { client, getUser } = createMockClient();
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      blockUser(client, "22222222-2222-2222-2222-222222222222"),
    ).rejects.toThrow("Authentication required");
  });

  it("unblocks a user by blocked id", async () => {
    const { client, deleteEq } = createMockClient();

    await unblockUser(client, "22222222-2222-2222-2222-222222222222");

    expect(deleteEq).toHaveBeenCalledWith(
      "blocked_id",
      "22222222-2222-2222-2222-222222222222",
    );
  });
});
