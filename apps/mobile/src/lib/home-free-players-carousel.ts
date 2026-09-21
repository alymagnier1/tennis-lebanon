import { compactJoinedLabel } from "./match-clubs";

/** Wide enough to read, still peeks the next card on ~390px with 28px screen gutters. */
export const HOME_FREE_PLAYER_CARD_WIDTH = 300;
export const HOME_FREE_PLAYER_CARD_GAP = 12;
export const HOME_FREE_PLAYER_SNAP_INTERVAL =
  HOME_FREE_PLAYER_CARD_WIDTH + HOME_FREE_PLAYER_CARD_GAP;

/** Pull past the last card (or fling at the end) to switch time windows. */
export const HOME_FREE_PLAYER_OVERSCROLL_PX = 40;
export const HOME_FREE_PLAYER_END_FLING_VX = 0.35;
/** Trailing strip slack so web (no bounce) can scroll past "View all". */
export const HOME_FREE_PLAYER_TRAILING_SLACK_PX = 56;

/**
 * Start offsets for each player card plus the trailing "View all" tile.
 * Interval is card width + strip gap so native snap and CSS scroll-snap stay aligned.
 */
export function homeFreePlayerSnapOffsets(playerCount: number): number[] {
  const count = Math.max(0, playerCount);
  const offsets: number[] = [];
  for (let index = 0; index <= count; index += 1) {
    offsets.push(index * HOME_FREE_PLAYER_SNAP_INTERVAL);
  }
  return offsets;
}

/**
 * Next / previous liquidity offer startsAt, or null at the ends.
 */
export function adjacentLiquidityOfferStartsAt(
  offers: readonly { startsAt: string }[],
  selectedStartsAt: string,
  direction: "next" | "prev",
): string | null {
  const index = offers.findIndex(
    (offer) => offer.startsAt === selectedStartsAt,
  );
  if (index < 0) return null;
  const nextIndex = direction === "next" ? index + 1 : index - 1;
  return offers[nextIndex]?.startsAt ?? null;
}

/**
 * True when the strip has been pulled (bounce / trailing slack) or flung past
 * the last card.
 */
export function homeFreePlayerShouldAdvanceOffer(input: {
  offsetX: number;
  contentWidth: number;
  viewportWidth: number;
  velocityX?: number;
  /** Already parked on / past the last snap before this gesture. */
  wasAtEnd: boolean;
  trailingSlackPx?: number;
}): boolean {
  const slack = input.trailingSlackPx ?? 0;
  const maxX = Math.max(0, input.contentWidth - input.viewportWidth);
  const endWithoutSlack = Math.max(0, maxX - slack);
  if (input.offsetX - endWithoutSlack >= HOME_FREE_PLAYER_OVERSCROLL_PX) {
    return true;
  }
  if (
    input.wasAtEnd &&
    input.offsetX >= endWithoutSlack - 2 &&
    (input.velocityX ?? 0) > HOME_FREE_PLAYER_END_FLING_VX
  ) {
    return true;
  }
  return false;
}

export function homeFreePlayerShouldRewindOffer(input: {
  offsetX: number;
  velocityX?: number;
  wasAtStart: boolean;
}): boolean {
  if (input.offsetX <= -HOME_FREE_PLAYER_OVERSCROLL_PX) {
    return true;
  }
  if (
    input.wasAtStart &&
    input.offsetX <= 2 &&
    (input.velocityX ?? 0) < -HOME_FREE_PLAYER_END_FLING_VX
  ) {
    return true;
  }
  return false;
}

/**
 * Zone row + reserved one-line slot under it.
 *
 * Bio takes the slot when the player wrote one; clubs then sit next to the
 * area as a compact "Hoops +2" chip, same as before. With no bio, the slot
 * lists every preferred club so the card stays the same height.
 */
export function homeFreePlayerDetailLine(input: {
  about: string;
  clubNames: string[];
}): {
  text: string;
  kind: "about" | "clubs" | "empty";
  metaClubLabel: string | undefined;
} {
  const about = input.about.replace(/\s+/g, " ").trim();
  const names = input.clubNames.map((name) => name.trim()).filter(Boolean);
  if (about) {
    return {
      text: about,
      kind: "about",
      metaClubLabel: compactJoinedLabel(names),
    };
  }
  if (names.length > 0) {
    return {
      text: names.join(" · "),
      kind: "clubs",
      metaClubLabel: undefined,
    };
  }
  return { text: "", kind: "empty", metaClubLabel: undefined };
}
