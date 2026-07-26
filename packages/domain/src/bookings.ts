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
