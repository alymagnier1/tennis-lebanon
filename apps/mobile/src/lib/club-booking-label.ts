import { isWhatsAppBookingClub } from "@tennis-lebanon/domain";

export function clubBookingModeLabelKey(bookingMode: string): string {
  return isWhatsAppBookingClub(bookingMode)
    ? "clubs.whatsappBooking"
    : "clubs.manualRequest";
}
