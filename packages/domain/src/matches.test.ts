import { describe, expect, it } from "vitest";
import {
  canManageProposedTimes,
  canReportMatchPlayed,
  canRescheduleMatch,
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
      preferredClubIds: ["22222222-2222-2222-2222-222222222222"],
      proposedTimes: [
        {
          startsAt: "2030-01-01T10:00:00.000Z",
          endsAt: "2030-01-01T11:30:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  describe("canReportMatchPlayed", () => {
    const stranded = {
      viewerIsParticipant: true,
      matchStatus: "ready_to_book",
      hasAcceptedBooking: false,
      hasUpcomingTime: false,
    };

    // The hour went by with no court recorded. Left alone this expires as
    // though the match never happened.
    it("asks about a match whose hour passed with no court", () => {
      expect(canReportMatchPlayed(stranded)).toBe(true);
      expect(
        canReportMatchPlayed({ ...stranded, matchStatus: "booking_pending" }),
      ).toBe(true);
    });

    it("stays quiet while the hour is still ahead", () => {
      expect(canReportMatchPlayed({ ...stranded, hasUpcomingTime: true })).toBe(
        false,
      );
    });

    // A court means the ordinary confirmed flow already has it.
    it("stays quiet once a court exists", () => {
      expect(
        canReportMatchPlayed({ ...stranded, hasAcceptedBooking: true }),
      ).toBe(false);
    });

    it("does not ask people who were not in the match", () => {
      expect(
        canReportMatchPlayed({ ...stranded, viewerIsParticipant: false }),
      ).toBe(false);
    });

    it("does not ask about matches that never had a roster or already moved on", () => {
      for (const matchStatus of [
        "open",
        "full",
        "confirmed",
        "in_progress",
        "completed",
        "expired",
      ]) {
        expect(canReportMatchPlayed({ ...stranded, matchStatus })).toBe(false);
      }
    });
  });

  describe("preferred clubs", () => {
    const base = {
      format: "singles",
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
    };

    // A public listing that names only an area leaves a joiner deciding
    // whether to drive without knowing where.
    it("requires at least one club on a public match", () => {
      const result = createMatchInputSchema.safeParse({
        ...base,
        visibility: "public",
        preferredClubIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["preferredClubIds"]);
    });

    it("lets private and invite-only matches fall back to zones", () => {
      for (const visibility of ["private", "invite_only"]) {
        expect(
          createMatchInputSchema.safeParse({
            ...base,
            visibility,
            preferredClubIds: [],
          }).success,
        ).toBe(true);
      }
    });

    it("caps the shortlist at three", () => {
      const result = createMatchInputSchema.safeParse({
        ...base,
        visibility: "public",
        preferredClubIds: [
          "22222222-2222-2222-2222-222222222221",
          "22222222-2222-2222-2222-222222222222",
          "22222222-2222-2222-2222-222222222223",
          "22222222-2222-2222-2222-222222222224",
        ],
      });

      expect(result.success).toBe(false);
    });

    it("defaults to an empty shortlist so private matches need not pass one", () => {
      const result = createMatchInputSchema.safeParse({
        ...base,
        visibility: "private",
      });

      expect(result.success).toBe(true);
      expect(result.data?.preferredClubIds).toEqual([]);
    });
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
    // Voting only exists on flexible matches.
    expect(
      canVoteOnTimes({
        viewerStatus: "accepted",
        matchStatus: "full",
        timingMode: "flexible",
      }),
    ).toBe(true);
    expect(
      canVoteOnTimes({
        viewerStatus: "accepted",
        matchStatus: "open",
        timingMode: "flexible",
      }),
    ).toBe(true);
    expect(
      canVoteOnTimes({
        viewerStatus: "requested",
        matchStatus: "full",
        timingMode: "flexible",
      }),
    ).toBe(false);
    expect(
      canVoteOnTimes({
        viewerStatus: "accepted",
        matchStatus: "full",
        timingMode: "fixed",
      }),
    ).toBe(false);

    expect(
      canManageProposedTimes({
        viewerIsCreator: true,
        matchStatus: "ready_to_book",
        timingMode: "flexible",
      }),
    ).toBe(true);
    expect(
      canManageProposedTimes({
        viewerIsCreator: false,
        matchStatus: "full",
        timingMode: "flexible",
      }),
    ).toBe(false);
    expect(
      canManageProposedTimes({
        viewerIsCreator: true,
        matchStatus: "full",
        timingMode: "fixed",
      }),
    ).toBe(false);

    // The host owns the time on a fixed match, until a court is requested.
    expect(
      canRescheduleMatch({
        viewerIsCreator: true,
        matchStatus: "ready_to_book",
        timingMode: "fixed",
      }),
    ).toBe(true);
    expect(
      canRescheduleMatch({
        viewerIsCreator: true,
        matchStatus: "booking_pending",
        timingMode: "fixed",
      }),
    ).toBe(false);
    expect(
      canRescheduleMatch({
        viewerIsCreator: false,
        matchStatus: "open",
        timingMode: "fixed",
      }),
    ).toBe(false);
    expect(
      canRescheduleMatch({
        viewerIsCreator: true,
        matchStatus: "open",
        timingMode: "flexible",
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
