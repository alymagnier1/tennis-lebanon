import {
  canBookClubInApp,
  isWhatsAppBookingClub,
} from "@tennis-lebanon/domain";

export type ClubBookingAction = "whatsapp" | "request" | "none";

/**
 * What a club row offers the host, from its booking mode.
 *
 * Every v1 club is `external_link`, so today this always returns "whatsapp" and
 * the other branches are unreachable. It exists anyway because partner clubs
 * invert the flow rather than extending it: with `manual_request` the host does
 * not know the court -- he sends a request and the club assigns one -- and a
 * shortlist can legitimately mix both kinds, so the decision belongs per row.
 * A resolver now costs a function; retrofitting one later costs the section.
 */
export function clubBookingAction(bookingMode: string): ClubBookingAction {
  if (isWhatsAppBookingClub(bookingMode)) return "whatsapp";
  if (canBookClubInApp(bookingMode)) return "request";
  return "none";
}
