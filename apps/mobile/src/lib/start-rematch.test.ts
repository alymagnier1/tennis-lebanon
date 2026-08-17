import { beforeEach, describe, expect, it, vi } from "vitest";

const getMatchHub = vi.fn();

vi.mock("@tennis-lebanon/api", () => ({
  getMatchHub: (...args: unknown[]) => getMatchHub(...args),
}));

const { resolveRematchTarget } = await import("./start-rematch");

const VIEWER = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  getMatchHub.mockReset();
});

function hubWith(participants: unknown) {
  return { match_id: "m1", participants };
}

function accepted(userId: string, name: string) {
  return { user_id: userId, display_name: name, status: "accepted" };
}

async function resolve(participants: unknown) {
  getMatchHub.mockResolvedValue(hubWith(participants));
  const result = await resolveRematchTarget({
    client: {} as never,
    matchId: "m1",
    viewerUserId: VIEWER,
  });
  return result.outcome;
}

describe("resolveRematchTarget", () => {
  it("returns the single opponent for a singles match", async () => {
    expect(
      await resolve([accepted(VIEWER, "You"), accepted("op-1", "Rami")]),
    ).toEqual({
      kind: "ready",
      opponentUserId: "op-1",
      opponentName: "Rami",
    });
  });

  it("asks the caller to send doubles to the hub rather than guessing", async () => {
    expect(
      await resolve([
        accepted(VIEWER, "You"),
        accepted("op-1", "Rami"),
        accepted("op-2", "Sara"),
        accepted("op-3", "Nadia"),
      ]),
    ).toEqual({ kind: "needsChoice" });
  });

  it("reports unavailable when everyone else left", async () => {
    expect(
      await resolve([
        accepted(VIEWER, "You"),
        { user_id: "op-1", display_name: "Rami", status: "left" },
      ]),
    ).toEqual({ kind: "unavailable" });
  });

  it("reports unavailable on a malformed participants payload", async () => {
    expect(await resolve(null)).toEqual({ kind: "unavailable" });
  });

  it("hands the hub back so the caller can build the draft without refetching", async () => {
    getMatchHub.mockResolvedValue(
      hubWith([accepted(VIEWER, "You"), accepted("op-1", "Rami")]),
    );

    const result = await resolveRematchTarget({
      client: {} as never,
      matchId: "m1",
      viewerUserId: VIEWER,
    });

    expect(result.hub.match_id).toBe("m1");
    expect(getMatchHub).toHaveBeenCalledTimes(1);
  });
});
