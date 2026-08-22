import type { MatchListBadge } from "./match-status-tone";
import { formatUnreadBadge } from "./unread-match-messages";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type BadgeInput = {
  is_stale_warning: boolean;
  unread_message_count: number;
};

/**
 * Badges for an Active list card, in the order they should be read.
 *
 * Unread chat comes first because it is the one that asks something of you:
 * a stale listing is a state of the match, while an unread message is somebody
 * waiting on an answer -- and chat is where a match renegotiates its time, so
 * it is the badge most likely to change what you do next.
 *
 * The count is capped by `formatUnreadBadge`, so a busy thread reads "9+"
 * rather than stretching the row.
 */
export function buildMatchCardBadges(
  t: Translate,
  match: BadgeInput,
): MatchListBadge[] | undefined {
  const badges: MatchListBadge[] = [];

  const unread = formatUnreadBadge(match.unread_message_count);
  if (unread) {
    badges.push({
      label: t("matches.chat.unreadBadge", {
        count: match.unread_message_count,
        display: unread,
      }),
      tone: "actionable",
    });
  }

  if (match.is_stale_warning) {
    badges.push({
      label: t("matches.lifecycle.staleBadge"),
      tone: "attention",
    });
  }

  return badges.length > 0 ? badges : undefined;
}
