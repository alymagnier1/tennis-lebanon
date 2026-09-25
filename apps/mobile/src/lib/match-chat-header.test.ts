import { describe, expect, it } from "vitest";
import { matchChatHeaderSubtitle } from "./match-chat-header";

describe("matchChatHeaderSubtitle", () => {
  const formatStartsAt = (iso: string) => `T:${iso}`;

  it("joins other accepted names with the match time", () => {
    expect(
      matchChatHeaderSubtitle({
        participants: [
          { user_id: "me", display_name: "Me", status: "accepted" },
          { user_id: "a", display_name: "Ali", status: "accepted" },
          { user_id: "b", display_name: "Sara", status: "accepted" },
          { user_id: "c", display_name: "Waiting", status: "requested" },
        ],
        viewerUserId: "me",
        startsAt: "2026-09-20T15:00:00.000Z",
        formatStartsAt,
      }),
    ).toBe("Ali · Sara · T:2026-09-20T15:00:00.000Z");
  });

  it("returns names only when there is no time", () => {
    expect(
      matchChatHeaderSubtitle({
        participants: [
          { user_id: "a", display_name: "Ali", status: "accepted" },
        ],
        viewerUserId: "me",
        startsAt: null,
        formatStartsAt,
      }),
    ).toBe("Ali");
  });

  it("returns time only when there are no other players yet", () => {
    expect(
      matchChatHeaderSubtitle({
        participants: [
          { user_id: "me", display_name: "Me", status: "accepted" },
        ],
        viewerUserId: "me",
        startsAt: "2026-09-20T15:00:00.000Z",
        formatStartsAt,
      }),
    ).toBe("T:2026-09-20T15:00:00.000Z");
  });
});
