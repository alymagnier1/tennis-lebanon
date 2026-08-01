/** Connection state of a Supabase realtime channel, as the UI sees it. */
export type RealtimeStatus = "connecting" | "connected" | "interrupted";

/**
 * Maps a Supabase channel status string onto our three-state view.
 *
 * `CLOSED` counts as interrupted rather than a clean shutdown: the only close
 * we cause ourselves happens in the effect teardown, where the component is
 * going away and nothing reads the status again.
 */
export function realtimeStatusFrom(event: string): RealtimeStatus {
  switch (event) {
    case "SUBSCRIBED":
      return "connected";
    case "CHANNEL_ERROR":
    case "TIMED_OUT":
    case "CLOSED":
      return "interrupted";
    default:
      return "connecting";
  }
}

/**
 * Whether a status change means we missed messages and have to refetch.
 *
 * Only the recovery edge matters. While a channel is down no insert callback
 * fires, so resubscribing alone leaves a hole exactly the length of the
 * outage — the socket reconnects and the transcript stays stale.
 */
export function shouldRefetchAfterStatusChange(
  previous: RealtimeStatus,
  next: RealtimeStatus,
): boolean {
  return previous === "interrupted" && next === "connected";
}
