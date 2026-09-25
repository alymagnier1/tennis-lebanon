import { compactJoinedLabel } from "./match-clubs";

type ChatParticipant = {
  user_id: string;
  display_name: string;
  status?: string;
};

/**
 * Subtitle under "Match chat": other accepted players, optionally plus time.
 */
export function matchChatHeaderSubtitle(input: {
  participants: ChatParticipant[];
  viewerUserId: string | undefined;
  startsAt: string | null;
  formatStartsAt: (iso: string) => string;
}): string | null {
  const others = input.participants
    .filter(
      (p) =>
        p.user_id !== input.viewerUserId &&
        (p.status === undefined || p.status === "accepted"),
    )
    .map((p) => p.display_name.trim())
    .filter(Boolean);

  // Up to three names so doubles still reads; then "+N".
  const names = compactJoinedLabel(others, 3);
  const when = input.startsAt ? input.formatStartsAt(input.startsAt) : null;

  if (names && when) return `${names} · ${when}`;
  if (names) return names;
  if (when) return when;
  return null;
}
