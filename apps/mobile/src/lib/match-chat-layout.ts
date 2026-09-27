/**
 * Layout rules for the match chat, kept out of the component so they can be
 * tested without rendering.
 */

/** Space under the composer while the keyboard is open. */
export const COMPOSER_GAP_ABOVE_KEYBOARD = 6;

/**
 * Bottom padding for the composer.
 *
 * With the keyboard closed, the composer has to clear the system navigation
 * bar (`bottomInset`). With it open, the keyboard-avoiding view already lifts
 * the composer to the keyboard's top edge, and the keyboard covers the bar --
 * so padding for the bar as well left an empty strip between the message box
 * and the keyboard (reported 2026-09-26).
 */
export function composerBottomPadding(input: {
  bottomInset: number;
  keyboardVisible: boolean;
}): number {
  if (input.keyboardVisible) return COMPOSER_GAP_ABOVE_KEYBOARD;
  return Math.max(input.bottomInset, 10);
}

/**
 * Which sender-name colour a participant gets. Stable for an author across
 * renders and sessions, so a player keeps their colour, as in WhatsApp groups.
 */
export function senderColorIndex(
  authorId: string,
  paletteSize: number,
): number {
  if (paletteSize <= 0) return 0;
  let hash = 0;
  for (let index = 0; index < authorId.length; index += 1) {
    hash = (hash * 31 + authorId.charCodeAt(index)) >>> 0;
  }
  return hash % paletteSize;
}

/**
 * Invisible room at the end of a message for the timestamp, which is drawn in
 * the bubble's bottom corner as WhatsApp does. En spaces at the body size are
 * about as wide as the time's characters at its smaller size, plus a margin.
 */
export function timestampSpacer(timeLabel: string): string {
  return " ".repeat(Math.ceil(timeLabel.length * 0.75) + 1);
}
