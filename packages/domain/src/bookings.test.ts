import { describe, expect, it } from "vitest";
import {
  buildWhatsAppBookingUrl,
  canBookClubInApp,
  canCancelBookingRequest,
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
