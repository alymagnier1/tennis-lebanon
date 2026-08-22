type CountableMessage = {
  author_id: string;
  created_at: string;
};

/**
 * How many messages in a match thread the viewer has not seen.
 *
 * Two rules, and the second is the one that is easy to get wrong: a message is
 * unread if it arrived after the viewer's read marker **and** somebody else
 * wrote it. Counting your own messages would light the badge the instant you
 * sent something, which is the opposite of what a badge is for.
 *
 * A null marker means the viewer has never opened this thread, so everything
 * anyone else wrote is unread. Messages exactly on the marker are treated as
 * read: the marker is written as `now()` when the chat opens, so an equal
 * timestamp is the message that was on screen at the time.
 */
export function countUnreadMatchMessages(input: {
  messages: CountableMessage[];
  lastReadAt: string | null;
  viewerUserId: string | undefined;
}): number {
  const { messages, lastReadAt, viewerUserId } = input;
  if (!viewerUserId) {
    return 0;
  }

  const readUntil = lastReadAt ? Date.parse(lastReadAt) : null;

  return messages.filter((message) => {
    if (message.author_id === viewerUserId) {
      return false;
    }
    if (readUntil === null) {
      return true;
    }
    const sentAt = Date.parse(message.created_at);
    return Number.isFinite(sentAt) && sentAt > readUntil;
  }).length;
}

/** Badges stop being counts past this and become "a lot". */
export function formatUnreadBadge(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return count > 9 ? "9+" : String(count);
}
