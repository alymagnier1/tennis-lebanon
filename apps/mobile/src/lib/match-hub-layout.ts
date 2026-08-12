import type { MatchHubBooking, MatchHubCard } from "@tennis-lebanon/api";

/** Court is secured — discovery metadata is no longer actionable. */
export function isHubCourtLocked(booking: MatchHubBooking | null): boolean {
  return booking?.status === "accepted";
}

/** Roster and time are set; next step is booking (or awaiting club). */
export function isHubReadyToBookStage(
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
): boolean {
  if (isHubCourtLocked(booking)) return false;
  return hub.status === "ready_to_book" || hub.status === "booking_pending";
}

export function shouldUsePolishedHubLayout(
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
): boolean {
  return isHubCourtLocked(booking) || isHubReadyToBookStage(hub, booking);
}

export function shouldShowDiscoveryOverview(
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
): boolean {
  return !shouldUsePolishedHubLayout(hub, booking);
}

export function shouldShowAgreedTimeSection(
  hasAgreedSlot: boolean,
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
): boolean {
  return (
    hasAgreedSlot &&
    !isHubCourtLocked(booking) &&
    !isHubReadyToBookStage(hub, booking)
  );
}

export function shouldShowPayAtClubBanner(
  nextAction: string | null | undefined,
  booking: MatchHubBooking | null,
): boolean {
  return nextAction === "pay_at_club" && !isHubCourtLocked(booking);
}

export function shouldShowTimeAgreedBanner(
  nextAction: string | null | undefined,
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
): boolean {
  return (
    nextAction === "time_agreed" &&
    !shouldUsePolishedHubLayout(hub, booking)
  );
}
