import { describe, expect, it } from "vitest";
import {
  countUnreadMatchMessages,
  formatUnreadBadge,
} from "./unread-match-messages";

const viewer = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";

const message = (author: string, iso: string) => ({
  author_id: author,
  created_at: iso,
});

describe("countUnreadMatchMessages", () => {
  it("counts everything from others when the thread was never opened", () => {
    expect(
      countUnreadMatchMessages({
        messages: [
          message(other, "2026-08-22T10:00:00Z"),
          message(other, "2026-08-22T11:00:00Z"),
        ],
        lastReadAt: null,
        viewerUserId: viewer,
      }),
    ).toBe(2);
  });

  it("never counts the viewer's own messages", () => {
    // Otherwise the badge lights up the moment you send something.
    expect(
      countUnreadMatchMessages({
        messages: [
          message(viewer, "2026-08-22T10:00:00Z"),
          message(viewer, "2026-08-22T11:00:00Z"),
        ],
        lastReadAt: null,
        viewerUserId: viewer,
      }),
    ).toBe(0);
  });

  it("counts only what arrived after the marker", () => {
    expect(
      countUnreadMatchMessages({
        messages: [
          message(other, "2026-08-22T09:00:00Z"),
          message(other, "2026-08-22T12:00:00Z"),
        ],
        lastReadAt: "2026-08-22T10:00:00Z",
        viewerUserId: viewer,
      }),
    ).toBe(1);
  });

  it("treats a message exactly on the marker as read", () => {
    // The marker is written as now() when the chat opens, so an equal stamp is
    // the message that was on screen at that moment.
    expect(
      countUnreadMatchMessages({
        messages: [message(other, "2026-08-22T10:00:00Z")],
        lastReadAt: "2026-08-22T10:00:00Z",
        viewerUserId: viewer,
      }),
    ).toBe(0);
  });

  it("counts nothing before the viewer is known", () => {
    expect(
      countUnreadMatchMessages({
        messages: [message(other, "2026-08-22T10:00:00Z")],
        lastReadAt: null,
        viewerUserId: undefined,
      }),
    ).toBe(0);
  });
});

describe("formatUnreadBadge", () => {
  it("hides at zero and caps at nine", () => {
    expect(formatUnreadBadge(0)).toBeNull();
    expect(formatUnreadBadge(-1)).toBeNull();
    expect(formatUnreadBadge(3)).toBe("3");
    expect(formatUnreadBadge(9)).toBe("9");
    expect(formatUnreadBadge(10)).toBe("9+");
  });
});
