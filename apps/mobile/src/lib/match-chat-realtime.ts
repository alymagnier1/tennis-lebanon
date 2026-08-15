import type { TennisSupabaseClient } from "@tennis-lebanon/api";
import {
  channelNameFor,
  isChannelTopic,
  removeChannelsFor,
} from "./realtime-channels";

export const MATCH_CHAT_CHANNEL_PREFIX = "match-chat:";

/** Poll interval when realtime subscribe races or fails (ms). */
export const MATCH_CHAT_POLL_MS = 15_000;

export function matchChatChannelName(matchId: string): string {
  return channelNameFor(MATCH_CHAT_CHANNEL_PREFIX, matchId);
}

export function isMatchChatChannelTopic(
  topic: string,
  matchId: string,
): boolean {
  return isChannelTopic(topic, matchChatChannelName(matchId));
}

/** Remove stale channels so a fresh subscribe never hits "after subscribe()" errors. */
export async function removeMatchChatChannels(
  client: TennisSupabaseClient,
  matchId: string,
): Promise<void> {
  await removeChannelsFor(client, MATCH_CHAT_CHANNEL_PREFIX, matchId);
}
