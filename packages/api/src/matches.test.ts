import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptMatchInvite,
  acceptMatchInvitation,
  addMatchTimeOption,
  castMatchTimeVote,
  createAndPublishMatch,
  createMatchDraft,
  cancelMatchInvite,
  createMatchInvite,
  declineMatchInvitation,
  getMatchHub,
  joinMatch,
  listAgreedTimeConflicts,
  listMyMatchInvites,
  listMyMatches,
  listMyCompletedMatches,
  previewMatchInvite,
  publishMatch,
  removeMatchParticipant,
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
      preferredClubIds: ["bbbbbbbb-0001-0001-0001-000000000001"],
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
      p_preferred_club_ids: ["bbbbbbbb-0001-0001-0001-000000000001"],
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
        preferredClubIds: [],
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

  it("joins a match with an optional note", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: "requested", error: null });

    await expect(joinMatch(client, "match-id", "Happy to play")).resolves.toBe(
      "requested",
    );
    expect(rpc).toHaveBeenCalledWith("join_match", {
      p_match_id: "match-id",
      p_note: "Happy to play",
    });
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
      createMatchInvite(client, "match-id", "user-id", "Fancy a hit"),
    ).resolves.toBe("token");
    expect(rpc).toHaveBeenCalledWith("create_match_invite", {
      p_match_id: "match-id",
      p_invited_user_id: "user-id",
      p_note: "Fancy a hit",
    });
    await expect(acceptMatchInvite(client, "token")).resolves.toBe("match-id");
  });

  it("previews an invite token without accepting it", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({
      data: { status: "ok", match_id: "match-id", capacity: 4 },
      error: null,
    });

    await expect(previewMatchInvite(client, "token")).resolves.toEqual({
      status: "ok",
      match_id: "match-id",
      capacity: 4,
    });
    // The whole point of the function: reading a token must reach the read,
    // never `accept_match_invite`.
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("preview_match_invite", {
      p_token: "token",
    });
  });

  it("surfaces a refusal without a summary", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({
      data: { status: "wrong_recipient", match_id: null },
      error: null,
    });

    const preview = await previewMatchInvite(client, "token");
    expect(preview.status).toBe("wrong_recipient");
    expect(preview.match_id).toBeNull();
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

  // Separate RPC from declining on purpose: a withdrawal leaves `declined_at`
  // null, which is what lets the hub tell "they said no" from "I took it back".
  it("withdraws an invitation the host sent", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await cancelMatchInvite(client, "match-id", "user-id");
    expect(rpc).toHaveBeenCalledWith("cancel_match_invite", {
      p_match_id: "match-id",
      p_invited_user_id: "user-id",
    });
  });

  it("removes an accepted player via RPC", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await removeMatchParticipant(
      client,
      "match-id",
      "user-id",
      "conduct_issue",
    );
    expect(rpc).toHaveBeenCalledWith("remove_match_participant", {
      p_match_id: "match-id",
      p_user_id: "user-id",
      p_reason: "conduct_issue",
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

  it("reads agreed-time conflicts for a window without excluding a match", async () => {
    const { client, rpc } = createMockClient();
    const rows = [
      {
        match_id: "m-1",
        starts_at: "2030-01-01T16:00:00.000Z",
        ends_at: "2030-01-01T17:30:00.000Z",
      },
    ];
    rpc.mockResolvedValue({ data: rows, error: null });

    await expect(
      listAgreedTimeConflicts(client, {
        startsAt: "2030-01-01T16:30:00.000Z",
        endsAt: "2030-01-01T18:00:00.000Z",
      }),
    ).resolves.toEqual(rows);
    expect(rpc).toHaveBeenCalledWith("viewer_agreed_time_conflicts", {
      p_starts_at: "2030-01-01T16:30:00.000Z",
      p_ends_at: "2030-01-01T18:00:00.000Z",
    });
  });

  it("passes the match to exclude and treats no rows as no conflicts", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      listAgreedTimeConflicts(client, {
        startsAt: "2030-01-01T16:30:00.000Z",
        endsAt: "2030-01-01T18:00:00.000Z",
        excludeMatchId: "m-2",
      }),
    ).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith("viewer_agreed_time_conflicts", {
      p_starts_at: "2030-01-01T16:30:00.000Z",
      p_ends_at: "2030-01-01T18:00:00.000Z",
      p_exclude_match_id: "m-2",
    });
  });

  it("surfaces an RPC error from the conflict read", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(
      listAgreedTimeConflicts(client, {
        startsAt: "2030-01-01T16:30:00.000Z",
        endsAt: "2030-01-01T18:00:00.000Z",
      }),
    ).rejects.toEqual({ message: "boom" });
  });
});
