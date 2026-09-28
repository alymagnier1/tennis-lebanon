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
 * Leading slack before the first card; the strip opens scrolled past it.
 * Android clamps the offset at 0 and derives fling velocity from offset
 * changes, so without room to pull into, a rewind could never register.
 */
export const HOME_FREE_PLAYER_LEADING_SLACK_PX = 56;

/**
 * Start offsets for each player card plus the trailing "View all" tile.
 * Interval is card width + strip gap so native snap and CSS scroll-snap stay aligned.
 *
 * `maxOffsetX` is the last resting offset (scrollable end minus trailing
 * slack). Offsets past it are pulled back to it: a snap target inside the
 * slack would land the strip in the advance zone and switch windows on its
 * own.
 */
export function homeFreePlayerSnapOffsets(
  playerCount: number,
  options: { leadingSlackPx?: number; maxOffsetX?: number } = {},
): number[] {
  const count = Math.max(0, playerCount);
  const leading = options.leadingSlackPx ?? 0;
  const max = options.maxOffsetX;
  const offsets: number[] = [];
  for (let index = 0; index <= count; index += 1) {
    const raw = leading + index * HOME_FREE_PLAYER_SNAP_INTERVAL;
    const offset =
      max === undefined ? raw : Math.max(leading, Math.min(raw, max));
    if (offsets[offsets.length - 1] !== offset) {
      offsets.push(offset);
    }
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
  /** Offset of the first card; pulling this far back into slack counts. */
  leadingSlackPx?: number;
}): boolean {
  const start = input.leadingSlackPx ?? 0;
  if (input.offsetX <= start - HOME_FREE_PLAYER_OVERSCROLL_PX) {
    return true;
  }
  if (
    input.wasAtStart &&
    input.offsetX <= start + 2 &&
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
