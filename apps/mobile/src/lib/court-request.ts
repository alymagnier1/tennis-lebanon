import type { MatchCourtRequest } from "@tennis-lebanon/api";

/**
 * Court reach-outs on the hub.
 *
 * v1 secures courts over WhatsApp, so the host leaves the app mid-flow. These
 * helpers decide the two things the hub can say about that window: ask the host
 * what happened, and tell everyone else that somebody asked.
 *
 * Sorting is done here rather than trusted from the RPC — `list_match_court_
 * requests` already orders newest first, but a caller reordering the array
 * would silently change which request the host is answering.
 */

function byNewest(left: MatchCourtRequest, right: MatchCourtRequest): number {
  return right.opened_at.localeCompare(left.opened_at);
}

/**
 * The reach-out the host still has to answer, if any. Only ever the host's own:
 * `answer_court_request` rejects anyone else, so offering the prompt to a
 * joiner would be a button that cannot work.
 */
export function pendingCourtRequest(
  requests: MatchCourtRequest[],
  isHost: boolean,
): MatchCourtRequest | null {
  if (!isHost) {
    return null;
  }

  return (
    [...requests]
      .filter(
        (request) => request.status === "opened" && request.is_viewer_request,
      )
      .sort(byNewest)[0] ?? null
  );
}

/**
 * The most recent confirmed reach-out, for the line every participant sees.
 * A joiner who has committed to a time previously had no way to tell whether
 * anyone had contacted a club at all.
 */
export function latestSentCourtRequest(
  requests: MatchCourtRequest[],
): MatchCourtRequest | null {
  return (
    [...requests]
      .filter((request) => request.status === "sent")
      .sort(byNewest)[0] ?? null
  );
}

/** How many distinct clubs this match has been taken to. */
export function courtRequestClubCount(requests: MatchCourtRequest[]): number {
  return new Set(requests.map((request) => request.club_id)).size;
}
