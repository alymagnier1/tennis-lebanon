import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { channelNameFor, removeChannelsFor } from "../lib/realtime-channels";
import {
  invalidateMatchChatSurfaces,
  matchIdFromMessageInsert,
} from "../lib/match-chat-queries";
import {
  realtimeStatusFrom,
  shouldRefetchAfterStatusChange,
  type RealtimeStatus,
} from "../lib/realtime-status";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

export const UNREAD_MESSAGES_CHANNEL_PREFIX = "unread-messages:";

/** Poll when realtime is down so badges and hub previews still catch up. */
export const UNREAD_MESSAGES_POLL_MS = 10_000;

/**
 * Keeps unread-message badges and chat previews honest while browsing.
 *
 * `list_my_matches` returns `unread_message_count` and match cards render it;
 * the hub row uses `match-messages` + last-read. The only INSERT subscription
 * used to live inside `MatchChatPanel` (mounted only while reading that
 * thread) and the global watcher only invalidated `my-matches`, so the hub
 * badge stayed dark until pull-to-refresh.
 *
 * Deliberately unfiltered. `match_messages` RLS + realtime means Supabase only
 * delivers rows for matches this player can read.
 */
export function UnreadMessagesWatcher(): null {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let active: ReturnType<typeof supabase.channel> | null = null;
    let status: RealtimeStatus = "connecting";

    const refresh = (matchId?: string) => {
      invalidateMatchChatSurfaces(queryClient, matchId);
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => refresh(), UNREAD_MESSAGES_POLL_MS);
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    void (async () => {
      await removeChannelsFor(supabase, UNREAD_MESSAGES_CHANNEL_PREFIX, userId);
      if (cancelled) return;

      try {
        const next = supabase
          .channel(channelNameFor(UNREAD_MESSAGES_CHANNEL_PREFIX, userId))
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "match_messages" },
            (payload) => {
              refresh(matchIdFromMessageInsert(payload));
            },
          );

        if (cancelled) {
          await supabase.removeChannel(next);
          return;
        }

        active = next;
        next.subscribe((event) => {
          const previous = status;
          status = realtimeStatusFrom(event);

          if (status === "interrupted") {
            startPolling();
          }
          if (status === "connected") {
            stopPolling();
          }
          if (shouldRefetchAfterStatusChange(previous, status)) {
            refresh();
          }
        });
      } catch {
        if (!cancelled) {
          startPolling();
        }
      }
    })();

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        refresh();
      }
    };
    const appSub = AppState.addEventListener("change", onAppStateChange);

    return () => {
      cancelled = true;
      appSub.remove();
      stopPolling();
      if (active) void supabase.removeChannel(active);
    };
  }, [queryClient, userId]);

  return null;
}
