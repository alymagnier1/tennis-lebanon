import { beirutDateKey } from "./beirut-time";

export type MatchChatTranscriptMessage = {
  message_id: string;
  author_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
};

export type MatchChatTranscriptItem =
  | { type: "day"; key: string; dateKey: string; label: string }
  | {
      type: "message";
      key: string;
      message: MatchChatTranscriptMessage;
      showSender: boolean;
      /** First in a consecutive same-author run (after any day break). */
      groupStart: boolean;
    };

/**
 * Chronological transcript rows with day separators and sender grouping.
 * Input must already be oldest → newest (screen order).
 */
export function buildMatchChatTranscript(
  messages: MatchChatTranscriptMessage[],
  labelForDateKey: (dateKey: string) => string,
): MatchChatTranscriptItem[] {
  const items: MatchChatTranscriptItem[] = [];
  let lastDateKey: string | null = null;
  let lastAuthorId: string | null = null;

  for (const message of messages) {
    const dateKey = beirutDateKey(message.created_at);
    if (dateKey !== lastDateKey) {
      items.push({
        type: "day",
        key: `day:${dateKey}`,
        dateKey,
        label: labelForDateKey(dateKey),
      });
      lastDateKey = dateKey;
      lastAuthorId = null;
    }

    const groupStart = message.author_id !== lastAuthorId;
    items.push({
      type: "message",
      key: message.message_id,
      message,
      showSender: groupStart,
      groupStart,
    });
    lastAuthorId = message.author_id;
  }

  return items;
}

/** Beirut calendar day label: Today, Yesterday, or a short date. */
export function matchChatDayLabel(
  dateKey: string,
  input: {
    todayKey: string;
    yesterdayKey: string;
    todayLabel: string;
    yesterdayLabel: string;
    formatDateKey: (dateKey: string) => string;
  },
): string {
  if (dateKey === input.todayKey) return input.todayLabel;
  if (dateKey === input.yesterdayKey) return input.yesterdayLabel;
  return input.formatDateKey(dateKey);
}
