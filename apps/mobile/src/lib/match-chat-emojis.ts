/**
 * Quick reactions for match chat. Kept short so the tray stays one row on
 * a phone; players can still type any emoji from the system keyboard.
 */
export const MATCH_CHAT_EMOJIS = [
  "👍",
  "👎",
  "😂",
  "🙌",
  "🙏",
  "💪",
  "🎾",
  "🔥",
  "✅",
  "⏰",
  "📍",
  "👋",
  "😅",
  "❤️",
] as const;

export type MatchChatEmoji = (typeof MATCH_CHAT_EMOJIS)[number];

/** Append an emoji to the draft, with a space when joining onto existing text. */
export function appendChatEmoji(draft: string, emoji: string): string {
  if (!draft) return emoji;
  if (/\s$/u.test(draft)) return `${draft}${emoji}`;
  return `${draft} ${emoji}`;
}

/** True when the body is only emoji / whitespace (for larger bubble text). */
export function isEmojiOnlyMessage(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  // Strip emoji sequences (incl. ZWJ / skin tones) and leftover whitespace.
  const withoutEmoji = trimmed.replace(
    /\p{Extended_Pictographic}(\uFE0F|\uFE0E)?(\u200D\p{Extended_Pictographic}(\uFE0F|\uFE0E)?)*/gu,
    "",
  );
  return withoutEmoji.trim().length === 0;
}
