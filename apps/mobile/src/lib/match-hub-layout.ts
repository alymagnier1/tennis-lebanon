import type { MatchHubBooking, MatchHubCard } from "@tennis-lebanon/api";

/** Court is secured — discovery metadata is no longer actionable. */
export function isHubCourtLocked(booking: MatchHubBooking | null): boolean {
  return booking?.status === "accepted";
}

/**
 * Statuses that share the polished vs-hero once a time is agreed
 * (open recruiting through ready-to-book / awaiting club).
 */
export function isHubRosterHeroStatus(status: string): boolean {
  return (
    status === "open" ||
    status === "full" ||
    status === "ready_to_book" ||
    status === "booking_pending"
  );
}

/**
 * Same card as open-for-players: chips, vs avatars, time, preferred clubs.
 * Court-locked matches keep this layout and swap preferred clubs for the
 * booked venue. Flexible matches still list proposed times below for voting.
 *
 * `hasAgreedTime` is retained for call-site compatibility; recruiting uses the
 * vs card before a slot is agreed so joiners see clubs before they commit.
 */
export function isHubVsHeroStage(
  hub: Pick<MatchHubCard, "status">,
  _booking: MatchHubBooking | null,
  _hasAgreedTime = false,
): boolean {
  if (hub.status === "confirmed") return true;
  return isHubRosterHeroStatus(hub.status);
}

/** Roster and time are set; next step is booking (or awaiting club). */
export function isHubReadyToBookStage(
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
): boolean {
  if (isHubCourtLocked(booking)) return false;
  return hub.status === "ready_to_book" || hub.status === "booking_pending";
}

/**
 * Inline hub confirm is ready-to-book only. Court-first on `open` / `full`
 * still exists on club detail; putting it on the hub steals Invite.
 */
export function canConfirmCourtOnHub(
  canConfirmExternal: boolean,
  matchStatus: string,
): boolean {
  if (!canConfirmExternal) return false;
  return matchStatus === "ready_to_book" || matchStatus === "booking_pending";
}

export function shouldUsePolishedHubLayout(
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
  hasAgreedTime = false,
): boolean {
  return (
    isHubCourtLocked(booking) || isHubVsHeroStage(hub, booking, hasAgreedTime)
  );
}

export function shouldShowDiscoveryOverview(
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
  hasAgreedTime = false,
): boolean {
  return !shouldUsePolishedHubLayout(hub, booking, hasAgreedTime);
}

export function shouldShowAgreedTimeSection(
  hasAgreedSlot: boolean,
  hub: Pick<MatchHubCard, "status">,
  booking: MatchHubBooking | null,
): boolean {
  return (
    hasAgreedSlot &&
    !isHubCourtLocked(booking) &&
    !isHubVsHeroStage(hub, booking, hasAgreedSlot)
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
  hasAgreedTime = false,
): boolean {
  return (
    nextAction === "time_agreed" &&
    !shouldUsePolishedHubLayout(hub, booking, hasAgreedTime)
  );
}

/** Chat opens once recruiting ends; alone on an open listing there is nobody to message. */
export function isMatchHubChatAvailable(
  hub: Pick<MatchHubCard, "status" | "viewer_status">,
): boolean {
  if (hub.viewer_status !== "accepted") return false;
  if (hub.status === "open" || hub.status === "full") return false;
  return true;
}

/** Show a locked chat row while the roster is still filling. */
export function isMatchHubChatLocked(
  hub: Pick<MatchHubCard, "status" | "viewer_status">,
): boolean {
  return (
    hub.viewer_status === "accepted" &&
    (hub.status === "open" || hub.status === "full")
  );
}
