import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { channelNameFor, removeChannelsFor } from "../lib/realtime-channels";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

export const UNREAD_MESSAGES_CHANNEL_PREFIX = "unread-messages:";

/**
 * Keeps the unread-message badges honest while the player is looking at a list.
 *
 * `list_my_matches` returns `unread_message_count` and the match cards render
 * it, but nothing told React Query to refetch when a message arrived. The only
 * subscription to `match_messages` lived inside `MatchChatPanel`, which is
 * mounted only when you are already reading that conversation — precisely when
 * the badge does not matter. Sitting on the Matches tab, a message from the
 * other player produced no badge at all until the query went stale or the app
 * was backgrounded and reopened.
 *
 * Deliberately unfiltered. `match_messages` carries a select policy
 * (`match_messages_select_participant`, migration `019`) and realtime honours
 * RLS, so Supabase only delivers rows for matches this player is in. Filtering
 * by match id here would mean tracking the player's match list and resubscribing
 * whenever it changed, to reach the same result the database already enforces.
 *
 * Only invalidates. The count itself, including "written by somebody else", is
 * computed in `list_my_matches`.
 */
export function UnreadMessagesWatcher(): null {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let active: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      await removeChannelsFor(supabase, UNREAD_MESSAGES_CHANNEL_PREFIX, userId);
      if (cancelled) return;

      const next = supabase
        .channel(channelNameFor(UNREAD_MESSAGES_CHANNEL_PREFIX, userId))
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "match_messages" },
          () => {
            void queryClient.invalidateQueries({ queryKey: ["my-matches"] });
          },
        );

      if (cancelled) {
        await supabase.removeChannel(next);
        return;
      }

      active = next;
      next.subscribe();
    })();

    return () => {
      cancelled = true;
      if (active) void supabase.removeChannel(active);
    };
  }, [queryClient, userId]);

  return null;
}
