import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { removeChannelsFor } from "../lib/realtime-channels";
import {
  realtimeStatusFrom,
  shouldRefetchAfterStatusChange,
  type RealtimeStatus,
} from "../lib/realtime-status";
import { supabase } from "../lib/supabase";

export const MATCH_ACTIVITY_CHANNEL_PREFIX = "match-activity:";

/** Poll interval when realtime subscribe races or fails (ms). */
export const MATCH_ACTIVITY_POLL_MS = 15_000;

/**
 * Fires `onChange` when anything about a match moves, so the caller can refetch.
 *
 * Subscribes to that match's row in `match_activity` — a doorbell table holding
 * no match data, because the tables the hub actually reads have RLS on with no
 * select policy and would deliver no realtime events at all (see migration 056).
 *
 * Mirrors the subscription in `MatchChatPanel`, including its polling fallback
 * and the catch-up refetch on reconnect. That component still has its own copy;
 * it can adopt this hook once this has settled.
 */
export function useMatchActivity({
  matchId,
  enabled = true,
  onChange,
}: {
  matchId: string | undefined;
  enabled?: boolean;
  onChange: () => void;
}): { realtimeStatus: RealtimeStatus } {
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const statusRef = useRef<RealtimeStatus>("connecting");

  // Callers pass an inline closure; keeping it in a ref stops the effect from
  // tearing the channel down and rebuilding it on every render. Synced in its
  // own effect rather than during render, which React forbids for refs.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || !matchId) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fire = () => onChangeRef.current();

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(fire, MATCH_ACTIVITY_POLL_MS);
      setRealtimeStatus("interrupted");
    };

    const connect = async () => {
      try {
        await removeChannelsFor(
          supabase,
          MATCH_ACTIVITY_CHANNEL_PREFIX,
          matchId,
        );
        if (cancelled) return;

        const nextChannel = supabase
          .channel(`${MATCH_ACTIVITY_CHANNEL_PREFIX}${matchId}`)
          .on(
            "postgres_changes",
            {
              // The row is upserted, so the first change for a match is an
              // INSERT and every later one an UPDATE.
              event: "*",
              schema: "public",
              table: "match_activity",
              filter: `match_id=eq.${matchId}`,
            },
            fire,
          );

        if (cancelled) {
          await supabase.removeChannel(nextChannel);
          return;
        }

        channel = nextChannel;
        channel.subscribe((event) => {
          const next = realtimeStatusFrom(event);
          const previous = statusRef.current;
          statusRef.current = next;
          setRealtimeStatus(next);

          // Nothing fires while the channel is down, so the gap is exactly the
          // length of the outage unless we catch up on the way back.
          if (shouldRefetchAfterStatusChange(previous, next)) {
            fire();
          }
        });
      } catch {
        if (!cancelled) {
          startPolling();
        }
      }
    };

    void connect();

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        fire();
      }
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);

    return () => {
      cancelled = true;
      subscription.remove();
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      if (channel) {
        void supabase.removeChannel(channel);
      } else {
        void removeChannelsFor(
          supabase,
          MATCH_ACTIVITY_CHANNEL_PREFIX,
          matchId,
        );
      }
    };
  }, [enabled, matchId]);

  return { realtimeStatus };
}
