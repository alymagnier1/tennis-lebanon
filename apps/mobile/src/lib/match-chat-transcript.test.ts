import { describe, expect, it } from "vitest";
import {
  buildMatchChatTranscript,
  matchChatDayLabel,
} from "./match-chat-transcript";

describe("buildMatchChatTranscript", () => {
  it("inserts day separators and groups consecutive authors", () => {
    const items = buildMatchChatTranscript(
      [
        {
          message_id: "1",
          author_id: "a",
          author_display_name: "Ali",
          body: "Hi",
          // Beirut afternoon on 2026-09-19
          created_at: "2026-09-19T12:00:00.000Z",
        },
        {
          message_id: "2",
          author_id: "a",
          author_display_name: "Ali",
          body: "Again",
          created_at: "2026-09-19T12:05:00.000Z",
        },
        {
          message_id: "3",
          author_id: "b",
          author_display_name: "Sara",
          body: "Hello",
          created_at: "2026-09-20T10:00:00.000Z",
        },
      ],
      (key) => `D:${key}`,
    );

    expect(items.map((item) => item.type)).toEqual([
      "day",
      "message",
      "message",
      "day",
      "message",
    ]);
    expect(items[1]).toMatchObject({
      type: "message",
      showSender: true,
      groupStart: true,
    });
    expect(items[2]).toMatchObject({
      type: "message",
      showSender: false,
      groupStart: false,
    });
    expect(items[4]).toMatchObject({
      type: "message",
      showSender: true,
      groupStart: true,
    });
  });
});

describe("matchChatDayLabel", () => {
  it("uses today and yesterday labels", () => {
    expect(
      matchChatDayLabel("2026-09-20", {
        todayKey: "2026-09-20",
        yesterdayKey: "2026-09-19",
        todayLabel: "Today",
        yesterdayLabel: "Yesterday",
        formatDateKey: (k) => k,
      }),
    ).toBe("Today");
    expect(
      matchChatDayLabel("2026-09-19", {
        todayKey: "2026-09-20",
        yesterdayKey: "2026-09-19",
        todayLabel: "Today",
        yesterdayLabel: "Yesterday",
        formatDateKey: (k) => k,
      }),
    ).toBe("Yesterday");
    expect(
      matchChatDayLabel("2026-09-18", {
        todayKey: "2026-09-20",
        yesterdayKey: "2026-09-19",
        todayLabel: "Today",
        yesterdayLabel: "Yesterday",
        formatDateKey: (k) => `F:${k}`,
      }),
    ).toBe("F:2026-09-18");
  });
});
