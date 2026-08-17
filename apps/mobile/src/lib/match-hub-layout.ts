import type { MatchHubBooking, MatchHubCard } from "@tennis-lebanon/api";

/** Court is secured — discovery metadata is no longer actionable. */
export function isHubCourtLocked(booking: MatchHubBooking | null): boolean {
  return booking?.status === "accepted";
}

/** Recruiting through awaiting-club — vs-hero plus invite/book actions. */
export function isHubRosterHeroStatus(status: string): boolean {
  return (
    status === "open" ||
    status === "full" ||
    status === "ready_to_book" ||
    status === "booking_pending"
  );
}

/**
 * Played and closed matches keep the same vs card as open-for-players.
 * Draft stays on the setup overview; everything else shares chips, roster,
 * time, and clubs so the hub does not change shape after kickoff.
 */
const HUB_VS_HERO_STATUSES = new Set([
  "open",
  "full",
  "ready_to_book",
  "booking_pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
  "disputed",
]);

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
  return HUB_VS_HERO_STATUSES.has(hub.status);
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

/**
 * Chat opens once the roster is full.
 *
 * `full` used to be locked as well, which put the lock on precisely the state
 * where a group most needs to talk: `full` -> `ready_to_book` requires everyone
 * to vote yes on one time option (`docs/LIFECYCLE.md`), so a flexible match sat
 * at `full` needing a conversation to resolve the vote while the conversation
 * only unlocked once the vote resolved. It also meant withdrawing a time option
 * took `ready_to_book` -> `full` and re-locked a live thread mid-sentence, and
 * it made `matches.chat.lockedRecruiting` ("Chat opens when the roster is
 * full") describe a rule the code did not implement.
 *
 * `open` stays locked: a public listing has a fluid participant set, so
 * join-read-leave is a real privacy problem there, and a half-filled match
 * usually has nobody to message yet.
 *
 * This was never a security boundary. `send_match_message` and
 * `list_match_messages` gate on accepted participation only (019) and never on
 * match status, so the server already allowed both states -- the lock is
 * presentation, which is why widening it needs no migration.
 */
export function isMatchHubChatAvailable(
  hub: Pick<MatchHubCard, "status" | "viewer_status">,
): boolean {
  if (hub.viewer_status !== "accepted") return false;
  if (hub.status === "open") return false;
  return true;
}

/** Show a locked chat row while the listing is still recruiting. */
export function isMatchHubChatLocked(
  hub: Pick<MatchHubCard, "status" | "viewer_status">,
): boolean {
  return hub.viewer_status === "accepted" && hub.status === "open";
}
