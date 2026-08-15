import { describe, expect, it } from "vitest";
import { matchChatPreviewLabel } from "./match-chat-preview";

const t = (key: string) => key;

describe("matchChatPreviewLabel", () => {
  it("returns open hint when empty", () => {
    expect(matchChatPreviewLabel([], t)).toBe("matches.chat.openHint");
  });

  it("returns the latest message body", () => {
    expect(
      matchChatPreviewLabel(
        [
          {
            message_id: "1",
            match_id: "m",
            author_id: "a",
            author_display_name: "A",
            body: "See you at 8",
            created_at: "2026-08-12T17:00:00Z",
          },
        ],
        t,
      ),
    ).toBe("See you at 8");
  });
});
