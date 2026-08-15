import { describe, expect, it } from "vitest";
import {
  MATCH_CHAT_EMOJIS,
  appendChatEmoji,
  isEmojiOnlyMessage,
} from "./match-chat-emojis";

describe("appendChatEmoji", () => {
  it("inserts into an empty draft", () => {
    expect(appendChatEmoji("", "👍")).toBe("👍");
  });

  it("adds a space before the emoji when the draft has text", () => {
    expect(appendChatEmoji("See you", "👋")).toBe("See you 👋");
  });

  it("does not double-space after trailing whitespace", () => {
    expect(appendChatEmoji("See you ", "👋")).toBe("See you 👋");
  });
});

describe("isEmojiOnlyMessage", () => {
  it("recognises single and multi emoji bodies", () => {
    expect(isEmojiOnlyMessage("🎾")).toBe(true);
    expect(isEmojiOnlyMessage("👍 🔥")).toBe(true);
    expect(isEmojiOnlyMessage("👨‍👩‍👧")).toBe(true);
  });

  it("rejects mixed text", () => {
    expect(isEmojiOnlyMessage("ok 👍")).toBe(false);
    expect(isEmojiOnlyMessage("hello")).toBe(false);
    expect(isEmojiOnlyMessage("")).toBe(false);
  });
});

describe("MATCH_CHAT_EMOJIS", () => {
  it("stays a compact quick-react set", () => {
    expect(MATCH_CHAT_EMOJIS.length).toBeGreaterThanOrEqual(8);
    expect(MATCH_CHAT_EMOJIS.length).toBeLessThanOrEqual(20);
    expect(MATCH_CHAT_EMOJIS).toContain("🎾");
  });
});
