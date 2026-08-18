import { afterEach, describe, expect, it, vi } from "vitest";

const shareMock = vi.fn();

vi.mock("react-native", () => ({
  Share: { share: shareMock },
}));

describe("invite link", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("builds a deep link for the invite token", async () => {
    const { buildMatchInviteUrl } = await import("./invite-link");

    expect(buildMatchInviteUrl("abc123")).toBe(
      "tennislebanon:///invite/abc123",
    );
  });

  it("passes the message to the share sheet", async () => {
    shareMock.mockResolvedValue({ action: "sharedAction" });
    const { shareMatchInvite } = await import("./invite-link");

    await shareMatchInvite("Join my tennis match: link");

    expect(shareMock).toHaveBeenCalledWith({
      message: "Join my tennis match: link",
    });
  });

  it("stays quiet when no share target exists", async () => {
    // react-native-web rejects when the browser has no `navigator.share`. The
    // invite is already sent by then, so this must not surface as a failure.
    shareMock.mockRejectedValue(new Error("Share is not supported"));
    const { shareMatchInvite } = await import("./invite-link");

    await expect(
      shareMatchInvite("Join my tennis match"),
    ).resolves.toBeUndefined();
  });

  it("names the daily cap and falls back to generic invite copy", async () => {
    const { matchInviteErrorKey } = await import("./invite-link");

    expect(matchInviteErrorKey(new Error("invite_rate_limited"))).toBe(
      "matches.invite.rateLimited",
    );
    expect(matchInviteErrorKey(new Error("network down"))).toBe(
      "matches.invite.error",
    );
    expect(matchInviteErrorKey("not an error")).toBe("matches.invite.error");
    expect(matchInviteErrorKey(undefined)).toBe("matches.invite.error");
  });

  it("reads the cap off a PostgrestError, which is not an Error", async () => {
    // What supabase-js actually rejects with: a plain object. Testing
    // `instanceof Error` here would show the generic copy for every RPC failure.
    const { matchInviteErrorKey } = await import("./invite-link");

    expect(
      matchInviteErrorKey({
        code: "P0001",
        details: null,
        hint: null,
        message: "invite_rate_limited",
      }),
    ).toBe("matches.invite.rateLimited");
  });
});
