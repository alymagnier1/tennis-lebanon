import type { MatchListBadge } from "./match-status-tone";
import { formatUnreadBadge } from "./unread-match-messages";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type BadgeInput = {
  is_stale_warning: boolean;
  unread_message_count: number;
  pending_request_count?: number;
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

  // First, ahead of unread chat: somebody is waiting on a yes or no that only
  // this host can give, and until `060`'s Vault secrets exist there is no push
  // and no bell to find it by. The count is host-only, so a joiner never sees a
  // badge for a decision that is not theirs.
  const pending = match.pending_request_count ?? 0;
  if (pending > 0) {
    badges.push({
      label: t("matches.list.pendingRequestsBadge", { count: pending }),
      tone: "actionable",
    });
  }

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
