import type { AgreedTimeConflict } from "@tennis-lebanon/api";
import type { SlotWindow } from "./slot-window";

/**
 * Query options for the create screen's schedule-conflict warning.
 *
 * The answer belongs to one account: it lists matches *this* player agreed to
 * play. The key used to be the time window alone, and sign-out clears only the
 * profile query, so a second account signing in on the same running app within
 * the 30-second freshness window got the first account's cached conflict —
 * the wrong warning, and someone else's appointment on screen (2026-09-26
 * recheck). The user ID is part of the key, and nothing runs without one.
 */
export function agreedTimeConflictsQueryOptions(input: {
  userId: string | null | undefined;
  window: SlotWindow | null;
  fetchConflicts: (window: SlotWindow) => Promise<AgreedTimeConflict[]>;
}) {
  const { userId, window, fetchConflicts } = input;
  return {
    queryKey: [
      "agreed-time-conflicts",
      userId ?? null,
      window?.startsAt ?? null,
      window?.endsAt ?? null,
    ] as const,
    queryFn: () => {
      if (!window) throw new Error("agreed-time conflicts need a slot window");
      return fetchConflicts(window);
    },
    enabled: Boolean(userId && window),
    staleTime: 30_000,
  };
}
