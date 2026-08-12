import { describe, expect, it } from "vitest";
import {
  channelNameFor,
  isChannelTopic,
  removeChannelsFor,
} from "./realtime-channels";

describe("channelNameFor", () => {
  it("joins prefix and id", () => {
    expect(channelNameFor("match-activity:", "abc-123")).toBe(
      "match-activity:abc-123",
    );
  });
});

describe("isChannelTopic", () => {
  it("matches bare and realtime-prefixed topics", () => {
    const name = channelNameFor("match-activity:", "abc-123");
    expect(isChannelTopic(name, name)).toBe(true);
    expect(isChannelTopic(`realtime:${name}`, name)).toBe(true);
  });

  it("does not match another channel", () => {
    const name = channelNameFor("match-activity:", "abc-123");
    expect(isChannelTopic("realtime:match-activity:other", name)).toBe(false);
  });

  it("does not match the same id under a different prefix", () => {
    expect(
      isChannelTopic(
        "match-chat:abc-123",
        channelNameFor("match-activity:", "abc-123"),
      ),
    ).toBe(false);
  });
});

describe("removeChannelsFor", () => {
  it("removes only the channels for that prefix and id", async () => {
    const removed: string[] = [];
    const name = channelNameFor("match-activity:", "match-1");
    const channels = [
      { topic: name },
      { topic: `realtime:${name}` },
      { topic: "realtime:match-activity:match-2" },
      { topic: "realtime:match-chat:match-1" },
    ];

    const client = {
      getChannels: () => channels,
      removeChannel: async (channel: { topic: string }) => {
        removed.push(channel.topic);
      },
    };

    await removeChannelsFor(client as never, "match-activity:", "match-1");

    expect(removed).toEqual([name, `realtime:${name}`]);
  });
});
