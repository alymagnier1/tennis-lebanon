/**
 * Optional one-way notes on invites and approval-gated join requests.
 * Kept short so they cannot become a chat channel.
 */
export const PLAYER_NOTE_MAX = 140;

/** Rough URL shapes — http(s) and www. Server sanitizer is authoritative. */
const URL_LIKE = /(?:https?:\/\/|www\.)\S+/gi;

export function sanitizePlayerNote(
  raw: string | null | undefined,
): string | null {
  if (raw == null) {
    return null;
  }

  const cleaned = raw.replace(URL_LIKE, "").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return null;
  }

  if (cleaned.length > PLAYER_NOTE_MAX) {
    return cleaned.slice(0, PLAYER_NOTE_MAX);
  }

  return cleaned;
}
