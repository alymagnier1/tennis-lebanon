/**
 * What the profile's primary button should do for this player.
 *
 * It used to always create. If you already hosted a match with a free slot,
 * that create was doomed: the draft defaults to singles, and `schedule.tsx`
 * refuses to publish a second active singles listing — so the button walked you
 * into a dialog telling you about the very match that was listed further down
 * the same screen.
 *
 * `"pick"` opens the sheet instead, which names each match. `"create"` only
 * when there is genuinely nothing to offer, so the sheet never appears with a
 * single "create" option in it.
 */
export function playerProfileInviteAction(
  inviteableMatches: readonly unknown[],
): "create" | "pick" {
  return inviteableMatches.length === 0 ? "create" : "pick";
}
