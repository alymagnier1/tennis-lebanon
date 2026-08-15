import type { MatchMessageRow } from "@tennis-lebanon/api";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Latest message body for the hub chat entry, or the empty-state prompt. */
export function matchChatPreviewLabel(
  messages: MatchMessageRow[],
  t: Translate,
): string {
  if (messages.length === 0) {
    return t("matches.chat.openHint");
  }

  const latest = messages[0];
  if (!latest?.body.trim()) {
    return t("matches.chat.openHint");
  }

  return latest.body.trim();
}
