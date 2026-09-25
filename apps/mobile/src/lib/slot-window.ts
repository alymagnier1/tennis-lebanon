import { beirutLocalToUtcIso } from "./beirut-time";

export type SlotWindow = { startsAt: string; endsAt: string };

/**
 * A create-screen slot — a Beirut day, a Beirut start time and a length —
 * as the UTC window the server stores and compares.
 *
 * The end is the start plus the duration, not the end *time* on the same
 * *day*. The old inline version formatted `startTime + duration` as a clock
 * time and pinned it to `day`, so a match typed in at 11:30 PM ended at 1:00 AM
 * on the day it started — before it began — and publishing failed on the
 * `ends_at > starts_at` check. The time field accepts any time, so that was
 * reachable, and the conflict check needs the real window too.
 */
export function slotWindowUtc(slot: {
  day: string;
  startTime: string;
  duration: number;
}): SlotWindow {
  const startsAt = beirutLocalToUtcIso(slot.day, slot.startTime);
  const endsAt = new Date(
    new Date(startsAt).getTime() + slot.duration * 60_000,
  ).toISOString();
  return { startsAt, endsAt };
}
