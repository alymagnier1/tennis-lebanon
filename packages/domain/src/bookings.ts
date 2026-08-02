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
 * Deliberately wider than {@link canRequestCourt}. Requesting a court commits
 * the group to a club and stays with the creator; saying "we already have one"
 * only records what happened, and the person who booked it is usually whoever
 * holds the membership. `booking_pending` matters most of all: a club that
 * never replies is the common reason someone picks up the phone, and hiding
 * this action there is what leaves the match stranded.
 *
 * `open` and `full` are court-first: the host secures the court and recruits
 * against it. That case is narrower than the rest, and the rules mirror the
 * ones enforced in `confirm_external_court`:
 *
 * - creator only, because committing a venue before the group exists is the
 *   host's call and there is often nobody else in the match to make it;
 * - fixed timing with an agreed time, because a court needs an hour and a
 *   flexible match has none until the vote resolves.
 */
export function canConfirmExternalCourt(input: {
  viewerIsParticipant: boolean;
  viewerIsCreator: boolean;
  matchStatus: string;
  timingMode?: string | null;
  hasAgreedTime: boolean;
  hasAcceptedBooking?: boolean;
}): boolean {
  if (!input.viewerIsParticipant) return false;

  // Before court-first, an accepted booking always meant the match had left
  // ready_to_book, so the status check covered this on its own. A court-first
  // match sits at `open` holding a court, and offering to record a second one
  // only produces "an active booking already exists".
  if (input.hasAcceptedBooking) return false;

  if (
    input.matchStatus === "ready_to_book" ||
    input.matchStatus === "booking_pending"
  ) {
    return true;
  }

  if (input.matchStatus === "open" || input.matchStatus === "full") {
    return (
      input.viewerIsCreator &&
      isFixedTimingMode(input.timingMode) &&
      input.hasAgreedTime
    );
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
