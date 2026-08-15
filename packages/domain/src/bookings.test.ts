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
    const host = {
      viewerIsParticipant: true,
      viewerIsCreator: true,
      timingMode: "fixed",
      hasAgreedTime: true,
    };

    it("is available to the host while a club request is still pending", () => {
      expect(
        canConfirmExternalCourt({
          ...host,
          matchStatus: "booking_pending",
        }),
      ).toBe(true);
    });

    it("is available to the host before any request has gone out", () => {
      expect(
        canConfirmExternalCourt({
          ...host,
          matchStatus: "ready_to_book",
        }),
      ).toBe(true);
    });

    it("stays host-only — joiners cannot book or confirm a court", () => {
      expect(
        canConfirmExternalCourt({
          ...host,
          viewerIsCreator: false,
          matchStatus: "ready_to_book",
        }),
      ).toBe(false);
      expect(
        canConfirmExternalCourt({
          ...host,
          viewerIsCreator: false,
          matchStatus: "booking_pending",
        }),
      ).toBe(false);
      expect(
        canConfirmExternalCourt({
          ...host,
          viewerIsParticipant: false,
          matchStatus: "ready_to_book",
        }),
      ).toBe(false);
    });

    it("is hidden once the match is confirmed or already played", () => {
      for (const matchStatus of ["confirmed", "in_progress", "completed"]) {
        expect(canConfirmExternalCourt({ ...host, matchStatus })).toBe(false);
      }
    });

    describe("court-first", () => {
      const courtFirst = {
        viewerIsParticipant: true,
        viewerIsCreator: true,
        timingMode: "fixed",
        hasAgreedTime: true,
      };

      it("lets the host secure a court while the match is still recruiting", () => {
        for (const matchStatus of ["open", "full"]) {
          expect(canConfirmExternalCourt({ ...courtFirst, matchStatus })).toBe(
            true,
          );
        }
      });

      it("stays creator-only before the roster fills", () => {
        expect(
          canConfirmExternalCourt({
            ...courtFirst,
            viewerIsCreator: false,
            matchStatus: "open",
          }),
        ).toBe(false);
      });

      it("is hidden once a court is already secured", () => {
        expect(
          canConfirmExternalCourt({
            ...courtFirst,
            matchStatus: "open",
            hasAcceptedBooking: true,
          }),
        ).toBe(false);
      });

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

    it("aligns with canRequestCourt on creator-only booking", () => {
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
