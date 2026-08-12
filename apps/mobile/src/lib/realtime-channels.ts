import type { TennisSupabaseClient } from "@tennis-lebanon/api";

/**
 * Channel naming and cleanup shared by every realtime subscription.
 *
 * Extracted from the chat helper so the match hub can reuse it rather than
 * grow a second copy; `match-chat-realtime.ts` now re-exports from here.
 */

export function channelNameFor(prefix: string, id: string): string {
  return `${prefix}${id}`;
}

/**
 * Supabase reports a channel's topic with a `realtime:` prefix once it has
 * subscribed, but without one before that, so both spellings have to match.
 */
export function isChannelTopic(topic: string, name: string): boolean {
  return topic === name || topic === `realtime:${name}`;
}

/** Remove stale channels so a fresh subscribe never hits "after subscribe()" errors. */
export async function removeChannelsFor(
  client: TennisSupabaseClient,
  prefix: string,
  id: string,
): Promise<void> {
  const name = channelNameFor(prefix, id);
  const stale = client
    .getChannels()
    .filter((channel) => isChannelTopic(channel.topic, name));

  for (const channel of stale) {
    await client.removeChannel(channel);
  }
}
