import { describe, expect, it } from "vitest";
import {
  buildWhatsAppBookingUrl,
  canBookClubInApp,
  canCancelBookingRequest,
  canConfirmExternalCourt,
  canRequestCourt,
  canRespondToBookingAlternative,
  formatPriceMinor,
  isWhatsAppBookingClub,
} from "./bookings";

describe("bookings domain", () => {
  it("allows creator to request court when ready_to_book", () => {
    expect(
      canRequestCourt({
        viewerIsCreator: true,
        matchStatus: "ready_to_book",
        nextAction: "request_court",
      }),
    ).toBe(true);
    expect(
      canRequestCourt({
        viewerIsCreator: false,
        matchStatus: "ready_to_book",
      }),
    ).toBe(false);
  });

  describe("canConfirmExternalCourt", () => {
    const rosterFirst = {
      viewerIsParticipant: true,
      viewerIsCreator: false,
      timingMode: "fixed",
      hasAgreedTime: true,
    };

    // The state that strands matches: the club never replied, so somebody rang
    // them directly. Requesting a court is hidden here, and this must not be.
    it("is available while a club request is still pending", () => {
      expect(
        canConfirmExternalCourt({
          ...rosterFirst,
          matchStatus: "booking_pending",
        }),
      ).toBe(true);
    });

    it("is available before any request has gone out", () => {
      expect(
        canConfirmExternalCourt({
          ...rosterFirst,
          matchStatus: "ready_to_book",
        }),
      ).toBe(true);
    });

    // Whoever holds the club membership does the booking, and that is often
    // not the creator.
    it("is available to any accepted participant, not just the creator", () => {
      expect(
        canConfirmExternalCourt({
          ...rosterFirst,
          matchStatus: "ready_to_book",
        }),
      ).toBe(true);
      expect(
        canConfirmExternalCourt({
          ...rosterFirst,
          viewerIsParticipant: false,
          matchStatus: "ready_to_book",
        }),
      ).toBe(false);
    });

    it("is hidden once the match is confirmed or already played", () => {
      for (const matchStatus of ["confirmed", "in_progress", "completed"]) {
        expect(canConfirmExternalCourt({ ...rosterFirst, matchStatus })).toBe(
          false,
        );
      }
    });

    describe("court-first", () => {
      const courtFirst = {
        viewerIsParticipant: true,
        viewerIsCreator: true,
        timingMode: "fixed",
        hasAgreedTime: true,
      };

      // The whole point: the host secures the court, then recruits against it.
      it("lets the host secure a court while the match is still recruiting", () => {
        for (const matchStatus of ["open", "full"]) {
          expect(canConfirmExternalCourt({ ...courtFirst, matchStatus })).toBe(
            true,
          );
        }
      });

      // Committing a venue before the group exists is the host's call.
      it("stays creator-only before the roster fills", () => {
        expect(
          canConfirmExternalCourt({
            ...courtFirst,
            viewerIsCreator: false,
            matchStatus: "open",
          }),
        ).toBe(false);
      });

      // Recording a second court only produces "an active booking already
      // exists"; before court-first the status check covered this on its own.
      it("is hidden once a court is already secured", () => {
        expect(
          canConfirmExternalCourt({
            ...courtFirst,
            matchStatus: "open",
            hasAcceptedBooking: true,
          }),
        ).toBe(false);
      });

      // A court needs an hour, and a flexible match has none until the vote
      // resolves; booking against an unvoted time bypasses the vote.
      it("requires fixed timing and an agreed time", () => {
        expect(
          canConfirmExternalCourt({
            ...courtFirst,
            timingMode: "flexible",
            matchStatus: "open",
          }),
        ).toBe(false);
        expect(
          canConfirmExternalCourt({
            ...courtFirst,
            hasAgreedTime: false,
            matchStatus: "open",
          }),
        ).toBe(false);
      });
    });

    // Requesting a club court is a different permission and stays narrower.
    it("is wider than canRequestCourt, which stays creator-only", () => {
      expect(
        canRequestCourt({
          viewerIsCreator: false,
          matchStatus: "booking_pending",
        }),
      ).toBe(false);
    });
  });

  it("gates alternative response and cancel", () => {
    expect(
      canRespondToBookingAlternative({
        viewerIsCreator: true,
        bookingStatus: "alternative_proposed",
      }),
    ).toBe(true);
    expect(
      canCancelBookingRequest({
        viewerIsCreator: true,
        bookingStatus: "requested",
      }),
    ).toBe(true);
  });

  it("formats price minor units", () => {
    expect(formatPriceMinor(4000, "USD")).toBe("USD 40");
    expect(formatPriceMinor(4550, "USD")).toBe("USD 45.50");
    expect(formatPriceMinor(null, "USD")).toBeNull();
  });

  it("detects whatsapp booking clubs and builds wa.me links", () => {
    expect(isWhatsAppBookingClub("external_link")).toBe(true);
    expect(canBookClubInApp("manual_request")).toBe(true);
    expect(
      buildWhatsAppBookingUrl({
        phoneDigits: "96170123456",
        message: "Hello club",
      }),
    ).toBe("https://wa.me/96170123456?text=Hello%20club");
  });
});
