import { isFixedTimingMode } from "./matches";

export function canRequestCourt(input: {
  viewerIsCreator: boolean;
  matchStatus: string;
  nextAction?: string | null;
}): boolean {
  if (!input.viewerIsCreator) return false;
  if (input.matchStatus !== "ready_to_book") return false;
  if (input.nextAction && input.nextAction !== "request_court") return false;
  return true;
}

/**
 * Recording a court arranged directly with the club, rather than through the
 * in-app queue.
 *
 * Host-only, same as {@link canRequestCourt}. Club contact and off-app
 * confirmation both commit the group to a venue, so joiners do not see either
 * action. `booking_pending` still matters: if the club never replies, the host
 * can record that they booked by phone or WhatsApp instead.
 *
 * Court-first (`open` / `full`) also requires fixed timing with an agreed
 * time — a court needs an hour, and a flexible match has none until the vote
 * resolves.
 */
export function canConfirmExternalCourt(input: {
  viewerIsParticipant: boolean;
  viewerIsCreator: boolean;
  matchStatus: string;
  timingMode?: string | null;
  hasAgreedTime: boolean;
  hasAcceptedBooking?: boolean;
}): boolean {
  if (!input.viewerIsParticipant || !input.viewerIsCreator) return false;

  if (input.hasAcceptedBooking) return false;

  if (
    input.matchStatus === "ready_to_book" ||
    input.matchStatus === "booking_pending"
  ) {
    return true;
  }

  if (input.matchStatus === "open" || input.matchStatus === "full") {
    return isFixedTimingMode(input.timingMode) && input.hasAgreedTime;
  }

  return false;
}

export function canRespondToBookingAlternative(input: {
  viewerIsCreator: boolean;
  bookingStatus?: string | null;
}): boolean {
  return (
    input.viewerIsCreator && input.bookingStatus === "alternative_proposed"
  );
}

export function canCancelBookingRequest(input: {
  viewerIsCreator: boolean;
  bookingStatus?: string | null;
}): boolean {
  return input.viewerIsCreator && input.bookingStatus === "requested";
}

export function formatPriceMinor(
  priceMinor: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (priceMinor == null || !currency) return null;
  const major = priceMinor / 100;
  return `${currency} ${major.toFixed(major % 1 === 0 ? 0 : 2)}`;
}

export function isWhatsAppBookingClub(bookingMode: string): boolean {
  return bookingMode === "external_link";
}

export function canBookClubInApp(bookingMode: string): boolean {
  return bookingMode === "manual_request";
}

export function buildWhatsAppBookingUrl(input: {
  phoneDigits: string;
  message: string;
}): string {
  const phone = input.phoneDigits.replace(/\D/g, "");
  const text = encodeURIComponent(input.message);
  return `https://wa.me/${phone}?text=${text}`;
}
