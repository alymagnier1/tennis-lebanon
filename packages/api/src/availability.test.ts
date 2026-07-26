import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listOwnAvailability,
} from "./availability";
import type { TennisSupabaseClient } from "./client";

function createMockClient() {
  const select = vi.fn();
  const insert = vi.fn();
  const deleteEq = vi.fn();
  const from = vi.fn();
  const client = { from } as unknown as TennisSupabaseClient;

  from.mockImplementation((table: string) => {
    if (table !== "availability_windows") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      select: select.mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "window-1" },
            error: null,
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: deleteEq.mockResolvedValue({ error: null }),
      }),
    };
  });

  return { client, select, insert, deleteEq, from };
}

describe("availability API wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists own availability windows", async () => {
    const { client, from } = createMockClient();

    await listOwnAvailability(client);

    expect(from).toHaveBeenCalledWith("availability_windows");
  });

  it("creates a recurring availability window", async () => {
    const { client, insert } = createMockClient();

    await createAvailabilityWindow(client, {
      user_id: "11111111-1111-1111-1111-111111111111",
      weekday: 5,
      local_start: "18:00",
      local_end: "21:00",
      timezone: "Asia/Beirut",
      is_recurring: true,
    });

    expect(insert).toHaveBeenCalledWith({
      user_id: "11111111-1111-1111-1111-111111111111",
      weekday: 5,
      local_start: "18:00",
      local_end: "21:00",
      timezone: "Asia/Beirut",
      is_recurring: true,
    });
  });

  it("deletes an availability window by id", async () => {
    const { client, deleteEq } = createMockClient();

    await deleteAvailabilityWindow(client, "window-1");

    expect(deleteEq).toHaveBeenCalledWith("id", "window-1");
  });
});
