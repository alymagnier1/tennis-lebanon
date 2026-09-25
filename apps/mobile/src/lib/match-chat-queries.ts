import type { QueryClient } from "@tanstack/react-query";

/**
 * Refresh every surface that shows chat unread or the transcript itself.
 *
 * Hub `MatchChatEntry` reads `match-messages` + last-read; Matches cards and
 * the tab badge read `my-matches.unread_message_count`. Invalidating only one
 * of those left the other stale when realtime delivered an INSERT.
 */
export function invalidateMatchChatSurfaces(
  queryClient: QueryClient,
  matchId?: string,
): void {
  void queryClient.invalidateQueries({ queryKey: ["my-matches"] });
  if (matchId) {
    void queryClient.invalidateQueries({
      queryKey: ["match-messages", matchId],
    });
  } else {
    void queryClient.invalidateQueries({ queryKey: ["match-messages"] });
  }
}

export function matchIdFromMessageInsert(payload: {
  new?: Record<string, unknown> | null;
}): string | undefined {
  const value = payload.new?.match_id;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
