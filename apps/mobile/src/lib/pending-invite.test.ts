import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const failures = { read: false, write: false };

vi.mock("./device-storage", () => ({
  readDeviceValue: vi.fn(async (key: string) => {
    if (failures.read) throw new Error("keystore unavailable");
    return store.get(key) ?? null;
  }),
  writeDeviceValue: vi.fn(async (key: string, value: string) => {
    if (failures.write) throw new Error("keystore unavailable");
    store.set(key, value);
  }),
  removeDeviceValue: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef";
const DAY = 24 * 60 * 60 * 1000;

describe("pending invite", () => {
  beforeEach(() => {
    store.clear();
    failures.read = false;
    failures.write = false;
  });

  it("hands back a remembered token once", async () => {
    const { rememberPendingInvite, takePendingInvite } =
      await import("./pending-invite");

    await rememberPendingInvite(TOKEN, 1_000);

    expect(await takePendingInvite(2_000)).toBe(TOKEN);
    expect(await takePendingInvite(3_000)).toBeNull();
  });

  it("returns null when nothing is pending", async () => {
    const { takePendingInvite } = await import("./pending-invite");

    expect(await takePendingInvite()).toBeNull();
  });

  it("drops a token older than the invitation lifetime", async () => {
    const { rememberPendingInvite, takePendingInvite } =
      await import("./pending-invite");

    await rememberPendingInvite(TOKEN, 0);

    expect(await takePendingInvite(15 * DAY)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("keeps a token that is still inside the lifetime", async () => {
    const { rememberPendingInvite, takePendingInvite } =
      await import("./pending-invite");

    await rememberPendingInvite(TOKEN, 0);

    expect(await takePendingInvite(13 * DAY)).toBe(TOKEN);
  });

  it("ignores something that is not an invite token", async () => {
    const { rememberPendingInvite, takePendingInvite } =
      await import("./pending-invite");

    await rememberPendingInvite("../../settings");

    expect(store.size).toBe(0);
    expect(await takePendingInvite()).toBeNull();
  });

  it("clears an unreadable stored value instead of redirecting", async () => {
    const { takePendingInvite } = await import("./pending-invite");
    store.set("tennis-lebanon.pending-invite", "{not json");

    expect(await takePendingInvite()).toBeNull();
    expect(store.size).toBe(0);
  });

  it("clearPendingInvite forgets the token", async () => {
    const { clearPendingInvite, rememberPendingInvite, takePendingInvite } =
      await import("./pending-invite");

    await rememberPendingInvite(TOKEN);
    await clearPendingInvite();

    expect(await takePendingInvite()).toBeNull();
  });

  it("never throws when the keystore fails", async () => {
    const { rememberPendingInvite, takePendingInvite } =
      await import("./pending-invite");
    failures.write = true;
    failures.read = true;

    await expect(rememberPendingInvite(TOKEN)).resolves.toBeUndefined();
    await expect(takePendingInvite()).resolves.toBeNull();
  });
});
