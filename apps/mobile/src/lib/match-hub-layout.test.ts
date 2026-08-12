import { describe, expect, it } from "vitest";
import {
  isHubCourtLocked,
  isHubReadyToBookStage,
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

describe("shouldUsePolishedHubLayout", () => {
  it("is true when court is locked or ready to book", () => {
    expect(shouldUsePolishedHubLayout(readyHub, null)).toBe(true);
    expect(shouldUsePolishedHubLayout(openHub, acceptedBooking)).toBe(true);
  });

  it("is false during open discovery", () => {
    expect(shouldUsePolishedHubLayout(openHub, null)).toBe(false);
  });
});

describe("shouldShowDiscoveryOverview", () => {
  it("hides during polished stages", () => {
    expect(shouldShowDiscoveryOverview(readyHub, null)).toBe(false);
    expect(shouldShowDiscoveryOverview(openHub, acceptedBooking)).toBe(false);
  });

  it("shows during open discovery", () => {
    expect(shouldShowDiscoveryOverview(openHub, null)).toBe(true);
  });
});

describe("shouldShowAgreedTimeSection", () => {
  it("hides when court is locked", () => {
    expect(shouldShowAgreedTimeSection(true, readyHub, acceptedBooking)).toBe(
      false,
    );
  });

  it("hides during ready-to-book polished stage", () => {
    expect(shouldShowAgreedTimeSection(true, readyHub, null)).toBe(false);
  });

  it("shows during open discovery with agreed slot", () => {
    expect(shouldShowAgreedTimeSection(true, openHub, null)).toBe(true);
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
    expect(shouldShowTimeAgreedBanner("time_agreed", readyHub, null)).toBe(
      false,
    );
  });

  it("shows during discovery before booking stage", () => {
    expect(shouldShowTimeAgreedBanner("time_agreed", openHub, null)).toBe(
      true,
    );
  });
});
