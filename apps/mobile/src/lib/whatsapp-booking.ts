import { Linking } from "react-native";
import type { ClubWhatsAppBookingLink } from "@tennis-lebanon/api";
import { buildWhatsAppBookingUrl } from "@tennis-lebanon/domain";

export async function openWhatsAppBooking(
  link: ClubWhatsAppBookingLink,
): Promise<void> {
  const url = buildWhatsAppBookingUrl({
    phoneDigits: link.phone_digits,
    message: link.message,
  });
  await Linking.openURL(url);
}
