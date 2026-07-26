import { describe, expect, it } from "vitest";
import {
  canManageProposedTimes,
  canShowJoinAction,
  canVoteOnTimes,
  canCreatorCancelBeforeBooking,
  capacityForFormat,
  createMatchInputSchema,
  findActiveHostedMatch,
  hasUnanimousTimeYes,
  isInviteableHostedMatch,
  isParticipantStatusActive,
  listOnDiscoverFromVisibility,
  visibilityFromListOnDiscover,
} from "./matches";

describe("matches domain rules", () => {
  it("returns capacity by format", () => {
    expect(capacityForFormat("singles")).toBe(2);
    expect(capacityForFormat("doubles")).toBe(4);
  });

  it("validates create match input", () => {
    const result = createMatchInputSchema.safeParse({
      format: "singles",
      visibility: "public",
      intent: "social",
      minSkill: "improving",
      maxSkill: "intermediate",
      requiresCreatorApproval: false,
      zoneIds: ["11111111-1111-1111-1111-111111111111"],
      proposedTimes: [
        {
          startsAt: "2030-01-01T10:00:00.000Z",
          endsAt: "2030-01-01T11:30:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid skill ranges and past times", () => {
    const result = createMatchInputSchema.safeParse({
      format: "singles",
      minSkill: "advanced",
      maxSkill: "beginner",
      zoneIds: ["11111111-1111-1111-1111-111111111111"],
      proposedTimes: [
        {
          startsAt: "2020-01-01T10:00:00.000Z",
          endsAt: "2020-01-01T11:30:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("derives join CTA state for viewers", () => {
    expect(
      canShowJoinAction({
        matchStatus: "open",
        requiresCreatorApproval: false,
      }),
    ).toBe("join");
    expect(
      canShowJoinAction({
        matchStatus: "open",
        requiresCreatorApproval: true,
      }),
    ).toBe("request");
    expect(
      canShowJoinAction({
        viewerStatus: "accepted",
        matchStatus: "open",
        requiresCreatorApproval: false,
      }),
    ).toBe("none");
  });

  it("derives time voting eligibility and agreement", () => {
    expect(
      canVoteOnTimes({ viewerStatus: "accepted", matchStatus: "full" }),
    ).toBe(true);
    expect(
      canVoteOnTimes({ viewerStatus: "accepted", matchStatus: "open" }),
    ).toBe(true);
    expect(
      canVoteOnTimes({ viewerStatus: "requested", matchStatus: "full" }),
    ).toBe(false);

    expect(
      canManageProposedTimes({
        viewerIsCreator: true,
        matchStatus: "ready_to_book",
      }),
    ).toBe(true);
    expect(
      canManageProposedTimes({
        viewerIsCreator: false,
        matchStatus: "full",
      }),
    ).toBe(false);

    expect(
      hasUnanimousTimeYes({
        yesCount: 2,
        requiredCount: 2,
        participantCount: 2,
        capacity: 2,
      }),
    ).toBe(true);
    expect(
      hasUnanimousTimeYes({
        yesCount: 1,
        requiredCount: 2,
        participantCount: 2,
        capacity: 2,
      }),
    ).toBe(false);
  });

  it("tracks active hosted matches per format", () => {
    const matches = [
      {
        match_id: "a",
        format: "singles",
        status: "open",
        is_creator: true,
        participant_count: 1,
        capacity: 2,
      },
      {
        match_id: "b",
        format: "doubles",
        status: "ready_to_book",
        is_creator: true,
        participant_count: 2,
        capacity: 4,
      },
    ];

    expect(findActiveHostedMatch(matches, "singles")?.match_id).toBe("a");
    expect(findActiveHostedMatch(matches, "doubles")?.match_id).toBe("b");
    expect(isInviteableHostedMatch(matches[0]!)).toBe(true);
    expect(isInviteableHostedMatch(matches[1]!)).toBe(true);
    expect(canCreatorCancelBeforeBooking("ready_to_book")).toBe(true);
    expect(canCreatorCancelBeforeBooking("confirmed")).toBe(false);
  });

  it("tracks active participant statuses", () => {
    expect(isParticipantStatusActive("accepted")).toBe(true);
    expect(isParticipantStatusActive("left")).toBe(false);
  });

  it("maps discover listing to match visibility", () => {
    expect(visibilityFromListOnDiscover(true)).toBe("public");
    expect(visibilityFromListOnDiscover(false)).toBe("invite_only");
    expect(listOnDiscoverFromVisibility("public")).toBe(true);
    expect(listOnDiscoverFromVisibility("invite_only")).toBe(false);
    expect(listOnDiscoverFromVisibility("private")).toBe(false);
  });
});
