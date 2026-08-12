import { describe, expect, it } from "vitest";
import {
  isMatchChatChannelTopic,
  matchChatChannelName,
  removeMatchChatChannels,
} from "./match-chat-realtime";

describe("matchChatChannelName", () => {
  it("prefixes match id", () => {
    expect(matchChatChannelName("abc-123")).toBe("match-chat:abc-123");
  });
});

describe("isMatchChatChannelTopic", () => {
  it("matches bare and realtime-prefixed topics", () => {
    const matchId = "abc-123";
    expect(isMatchChatChannelTopic(matchChatChannelName(matchId), matchId)).toBe(
      true,
    );
    expect(
      isMatchChatChannelTopic(`realtime:${matchChatChannelName(matchId)}`, matchId),
    ).toBe(true);
    expect(isMatchChatChannelTopic("realtime:other", matchId)).toBe(false);
  });
});

describe("removeMatchChatChannels", () => {
  it("removes channels for the match topic", async () => {
    const removed: string[] = [];
    const matchId = "match-1";
    const name = matchChatChannelName(matchId);
    const channels = [
      { topic: name },
      { topic: `realtime:${name}` },
      { topic: "realtime:other" },
    ];

    const client = {
      getChannels: () => channels,
      removeChannel: async (channel: { topic: string }) => {
        removed.push(channel.topic);
      },
    };

    await removeMatchChatChannels(client as never, matchId);

    expect(removed).toEqual([name, `realtime:${name}`]);
  });
});
