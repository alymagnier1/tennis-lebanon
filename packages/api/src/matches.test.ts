import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptMatchInvite,
  acceptMatchInvitation,
  addMatchTimeOption,
  castMatchTimeVote,
  createAndPublishMatch,
  createMatchDraft,
  createMatchInvite,
  declineMatchInvitation,
  getMatchHub,
  joinMatch,
  listMyMatchInvites,
  listMyMatches,
  listMyCompletedMatches,
  publishMatch,
  respondToJoinRequest,
  withdrawMatchTimeOption,
} from "./matches";
import type { TennisSupabaseClient } from "./client";

function createMockClient() {
  const rpc = vi.fn();
  const client = { rpc } as unknown as TennisSupabaseClient;
  return { client, rpc };
}

describe("matches API wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps create match input to the RPC", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: "match-id", error: null });

    await createAndPublishMatch(client, {
      format: "singles",
      visibility: "public",
      intent: "social",
      minSkill: "improving",
      maxSkill: "intermediate",
      requiresCreatorApproval: false,
      zoneIds: ["aaaaaaaa-0001-0001-0001-000000000001"],
      proposedTimes: [
        {
          startsAt: "2030-01-01T10:00:00.000Z",
          endsAt: "2030-01-01T11:30:00.000Z",
        },
      ],
      timingMode: "fixed",
    });

    expect(rpc).toHaveBeenCalledWith("create_and_publish_match", {
      p_format: "singles",
      p_visibility: "public",
      p_intent: "social",
      p_min_skill: "improving",
      p_max_skill: "intermediate",
      p_requires_creator_approval: false,
      p_notes: undefined,
      p_zone_ids: ["aaaaaaaa-0001-0001-0001-000000000001"],
      p_proposed_times: [
        {
          starts_at: "2030-01-01T10:00:00.000Z",
          ends_at: "2030-01-01T11:30:00.000Z",
        },
      ],
      p_timing_mode: "fixed",
    });
  });

  it("creates drafts and publishes matches", async () => {
    const { client, rpc } = createMockClient();
    rpc
      .mockResolvedValueOnce({ data: "draft-id", error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      createMatchDraft(client, {
        format: "singles",
        visibility: "invite_only",
        intent: "social",
        minSkill: "improving",
        maxSkill: "intermediate",
        requiresCreatorApproval: false,
        zoneIds: ["aaaaaaaa-0001-0001-0001-000000000001"],
        proposedTimes: [
          {
            startsAt: "2030-01-01T10:00:00.000Z",
            endsAt: "2030-01-01T11:30:00.000Z",
          },
        ],
        timingMode: "fixed",
      }),
    ).resolves.toBe("draft-id");

    await publishMatch(client, "draft-id");

    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "create_match_draft",
      expect.objectContaining({ p_format: "singles" }),
    );
    expect(rpc).toHaveBeenNthCalledWith(2, "publish_match", {
      p_match_id: "draft-id",
    });
  });

  it("joins a match via RPC", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: "accepted", error: null });

    await expect(joinMatch(client, "match-id")).resolves.toBe("accepted");
    expect(rpc).toHaveBeenCalledWith("join_match", { p_match_id: "match-id" });
  });

  it("responds to join requests", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: null, error: null });

    await respondToJoinRequest(client, "match-id", "user-id", true);
    expect(rpc).toHaveBeenCalledWith("respond_to_join_request", {
      p_match_id: "match-id",
      p_user_id: "user-id",
      p_accept: true,
    });
  });

  it("creates and accepts invites", async () => {
    const { client, rpc } = createMockClient();
    rpc
      .mockResolvedValueOnce({ data: "token", error: null })
      .mockResolvedValueOnce({ data: "match-id", error: null });

    await expect(
      createMatchInvite(client, "match-id", "user-id"),
    ).resolves.toBe("token");
    await expect(acceptMatchInvite(client, "token")).resolves.toBe("match-id");
  });

  it("loads hub and list data", async () => {
    const { client, rpc } = createMockClient();
    rpc
      .mockResolvedValueOnce({ data: { match_id: "match-id" }, error: null })
      .mockResolvedValueOnce({ data: [{ match_id: "match-id" }], error: null })
      .mockResolvedValueOnce({
        data: [{ match_id: "completed-id" }],
        error: null,
      });

    await expect(getMatchHub(client, "match-id")).resolves.toEqual({
      match_id: "match-id",
    });
    await expect(listMyMatches(client)).resolves.toEqual([
      { match_id: "match-id" },
    ]);
    await expect(listMyCompletedMatches(client)).resolves.toEqual([
      { match_id: "completed-id" },
    ]);
  });

  it("lists and responds to inbox invites", async () => {
    const { client, rpc } = createMockClient();
    rpc
      .mockResolvedValueOnce({
        data: [{ invitation_id: "invite-id", match_id: "match-id" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: "match-id", error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(listMyMatchInvites(client)).resolves.toEqual([
      { invitation_id: "invite-id", match_id: "match-id" },
    ]);
    await expect(acceptMatchInvitation(client, "invite-id")).resolves.toBe(
      "match-id",
    );
    await declineMatchInvitation(client, "invite-id");
    expect(rpc).toHaveBeenCalledWith("decline_match_invitation", {
      p_invitation_id: "invite-id",
    });
  });

  it("casts votes and manages proposed times", async () => {
    const { client, rpc } = createMockClient();
    rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: "option-id", error: null });

    await castMatchTimeVote(client, "match-id", "option-id", "yes");
    await withdrawMatchTimeOption(client, "option-id");
    await expect(
      addMatchTimeOption(
        client,
        "match-id",
        "2030-01-01T10:00:00.000Z",
        "2030-01-01T11:30:00.000Z",
      ),
    ).resolves.toBe("option-id");

    expect(rpc).toHaveBeenCalledWith("cast_match_time_vote", {
      p_match_id: "match-id",
      p_time_option_id: "option-id",
      p_vote: "yes",
    });
    expect(rpc).toHaveBeenCalledWith("withdraw_match_time_option", {
      p_time_option_id: "option-id",
    });
    expect(rpc).toHaveBeenCalledWith("add_match_time_option", {
      p_match_id: "match-id",
      p_starts_at: "2030-01-01T10:00:00.000Z",
      p_ends_at: "2030-01-01T11:30:00.000Z",
    });
  });
});
