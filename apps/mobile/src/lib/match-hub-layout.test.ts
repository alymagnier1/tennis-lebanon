import { describe, expect, it } from "vitest";
import {
  canConfirmCourtOnHub,
  isHubCourtLocked,
  isHubReadyToBookStage,
  isHubVsHeroStage,
  isMatchHubChatAvailable,
  isMatchHubChatLocked,
  shouldShowAgreedTimeSection,
  shouldShowDiscoveryOverview,
  shouldShowPayAtClubBanner,
  shouldShowTimeAgreedBanner,
  shouldUsePolishedHubLayout,
} from "./match-hub-layout";

const acceptedBooking = {
  booking_id: "b1",
  status: "accepted",
  court_id: "c1",
  court_name: "Court 1",
  club_id: "club1",
  club_name: "Club",
  starts_at: "2026-08-11T15:00:00Z",
  ends_at: "2026-08-11T16:00:00Z",
  price_minor: 4000,
  currency: "USD",
  payment_method: "at_club",
  club_note: null,
  proposed_court_id: null,
  proposed_court_name: null,
  proposed_start_at: null,
  proposed_end_at: null,
};

const readyHub = { status: "ready_to_book" as const };
const bookingPendingHub = { status: "booking_pending" as const };
const openHub = { status: "open" as const };
const fullHub = { status: "full" as const };

describe("isHubCourtLocked", () => {
  it("is true when booking is accepted", () => {
    expect(isHubCourtLocked(acceptedBooking)).toBe(true);
  });

  it("is false when booking is pending or missing", () => {
    expect(isHubCourtLocked({ ...acceptedBooking, status: "requested" })).toBe(
      false,
    );
    expect(isHubCourtLocked(null)).toBe(false);
  });
});

describe("isHubReadyToBookStage", () => {
  it("is true for ready_to_book and booking_pending without accepted booking", () => {
    expect(isHubReadyToBookStage(readyHub, null)).toBe(true);
    expect(isHubReadyToBookStage(bookingPendingHub, null)).toBe(true);
    expect(
      isHubReadyToBookStage(readyHub, {
        ...acceptedBooking,
        status: "requested",
      }),
    ).toBe(true);
  });

  it("is false when court is locked", () => {
    expect(isHubReadyToBookStage(readyHub, acceptedBooking)).toBe(false);
  });

  it("is false for discovery statuses", () => {
    expect(isHubReadyToBookStage(openHub, null)).toBe(false);
  });
});

describe("isHubVsHeroStage", () => {
  it("covers open recruiting and ready-to-book with or without an agreed time", () => {
    expect(isHubVsHeroStage(openHub, null, true)).toBe(true);
    expect(isHubVsHeroStage(openHub, null, false)).toBe(true);
    expect(isHubVsHeroStage(fullHub, null, false)).toBe(true);
    expect(isHubVsHeroStage(readyHub, null, true)).toBe(true);
  });

  it("keeps the vs-hero after the court is locked", () => {
    expect(isHubVsHeroStage(openHub, acceptedBooking, true)).toBe(true);
    expect(
      isHubVsHeroStage({ status: "confirmed" }, acceptedBooking, false),
    ).toBe(true);
  });

  it("keeps the same vs card through play and completion", () => {
    expect(isHubVsHeroStage({ status: "in_progress" }, null, true)).toBe(true);
    expect(
      isHubVsHeroStage({ status: "completed" }, acceptedBooking, true),
    ).toBe(true);
    expect(isHubVsHeroStage({ status: "cancelled" }, null, false)).toBe(true);
    expect(isHubVsHeroStage({ status: "expired" }, null, false)).toBe(true);
  });

  it("leaves draft on the setup overview", () => {
    expect(isHubVsHeroStage({ status: "draft" }, null, false)).toBe(false);
  });
});

describe("shouldUsePolishedHubLayout", () => {
  it("is true when court is locked or vs-hero stage", () => {
    expect(shouldUsePolishedHubLayout(readyHub, null, true)).toBe(true);
    expect(shouldUsePolishedHubLayout(openHub, null, true)).toBe(true);
    expect(shouldUsePolishedHubLayout(openHub, null, false)).toBe(true);
    expect(shouldUsePolishedHubLayout(openHub, acceptedBooking, false)).toBe(
      true,
    );
    expect(
      shouldUsePolishedHubLayout({ status: "in_progress" }, null, true),
    ).toBe(true);
    expect(
      shouldUsePolishedHubLayout(
        { status: "completed" },
        acceptedBooking,
        true,
      ),
    ).toBe(true);
  });
});

describe("shouldShowDiscoveryOverview", () => {
  it("hides during polished stages including open recruiting", () => {
    expect(shouldShowDiscoveryOverview(readyHub, null, true)).toBe(false);
    expect(shouldShowDiscoveryOverview(openHub, acceptedBooking, false)).toBe(
      false,
    );
    expect(shouldShowDiscoveryOverview(openHub, null, true)).toBe(false);
    expect(shouldShowDiscoveryOverview(openHub, null, false)).toBe(false);
    expect(
      shouldShowDiscoveryOverview({ status: "in_progress" }, null, true),
    ).toBe(false);
    expect(
      shouldShowDiscoveryOverview(
        { status: "completed" },
        acceptedBooking,
        true,
      ),
    ).toBe(false);
  });
});

describe("shouldShowAgreedTimeSection", () => {
  it("hides when court is locked", () => {
    expect(shouldShowAgreedTimeSection(true, readyHub, acceptedBooking)).toBe(
      false,
    );
  });

  it("hides when the vs-hero owns the time", () => {
    expect(shouldShowAgreedTimeSection(true, readyHub, null)).toBe(false);
    expect(shouldShowAgreedTimeSection(true, openHub, null)).toBe(false);
    expect(
      shouldShowAgreedTimeSection(true, { status: "in_progress" }, null),
    ).toBe(false);
    expect(
      shouldShowAgreedTimeSection(true, { status: "completed" }, null),
    ).toBe(false);
  });
});

describe("shouldShowPayAtClubBanner", () => {
  it("hides pay banner once court is accepted", () => {
    expect(shouldShowPayAtClubBanner("pay_at_club", acceptedBooking)).toBe(
      false,
    );
  });

  it("shows pay banner when court is not yet accepted", () => {
    expect(shouldShowPayAtClubBanner("pay_at_club", null)).toBe(true);
  });
});

describe("shouldShowTimeAgreedBanner", () => {
  it("hides when polished layout shows agreed-time hero", () => {
    expect(
      shouldShowTimeAgreedBanner("time_agreed", readyHub, null, true),
    ).toBe(false);
    expect(shouldShowTimeAgreedBanner("time_agreed", openHub, null, true)).toBe(
      false,
    );
    expect(
      shouldShowTimeAgreedBanner("time_agreed", openHub, null, false),
    ).toBe(false);
  });
});

describe("canConfirmCourtOnHub", () => {
  it("is true only once the roster is bookable", () => {
    expect(canConfirmCourtOnHub(true, "ready_to_book")).toBe(true);
    expect(canConfirmCourtOnHub(true, "booking_pending")).toBe(true);
  });

  it("stays off while recruiting so Invite remains the primary", () => {
    expect(canConfirmCourtOnHub(true, "open")).toBe(false);
    expect(canConfirmCourtOnHub(true, "full")).toBe(false);
  });

  it("is false when the viewer cannot confirm at all", () => {
    expect(canConfirmCourtOnHub(false, "ready_to_book")).toBe(false);
  });
});

describe("match hub chat gates", () => {
  it("locks chat while the listing is still recruiting", () => {
    expect(
      isMatchHubChatLocked({ status: "open", viewer_status: "accepted" }),
    ).toBe(true);
    expect(
      isMatchHubChatAvailable({ status: "open", viewer_status: "accepted" }),
    ).toBe(false);
  });

  it("opens chat as soon as the roster is full", () => {
    // `full` -> `ready_to_book` needs a unanimous time vote, so locking `full`
    // withheld chat from the one state that needs a conversation to leave it.
    expect(
      isMatchHubChatAvailable({ status: "full", viewer_status: "accepted" }),
    ).toBe(true);
    expect(
      isMatchHubChatLocked({ status: "full", viewer_status: "accepted" }),
    ).toBe(false);
  });

  it("opens chat once the roster is bookable", () => {
    expect(
      isMatchHubChatAvailable({
        status: "ready_to_book",
        viewer_status: "accepted",
      }),
    ).toBe(true);
    expect(
      isMatchHubChatLocked({
        status: "ready_to_book",
        viewer_status: "accepted",
      }),
    ).toBe(false);
  });

  it("does not re-lock a live thread when an agreed time is withdrawn", () => {
    // `ready_to_book` -> `full` used to close chat mid-conversation.
    for (const status of ["ready_to_book", "full"]) {
      expect(
        isMatchHubChatAvailable({ status, viewer_status: "accepted" }),
      ).toBe(true);
    }
  });

  it("stays open for the rest of the lifecycle", () => {
    for (const status of [
      "booking_pending",
      "confirmed",
      "in_progress",
      "completed",
    ]) {
      expect(
        isMatchHubChatAvailable({ status, viewer_status: "accepted" }),
      ).toBe(true);
    }
  });

  it("stays shut for anyone who is not an accepted participant", () => {
    for (const status of ["open", "full", "confirmed"]) {
      expect(
        isMatchHubChatAvailable({ status, viewer_status: "invited" }),
      ).toBe(false);
      expect(isMatchHubChatAvailable({ status, viewer_status: null })).toBe(
        false,
      );
      expect(isMatchHubChatLocked({ status, viewer_status: "left" })).toBe(
        false,
      );
    }
  });
});
