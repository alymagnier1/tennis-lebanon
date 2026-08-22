/** The window a club is plausibly open, in `Asia/Beirut` wall-clock hours. */
export const MATCH_START_HOUR = 7;
export const MATCH_END_HOUR = 21;

export type Meridiem = "AM" | "PM";
export type ParsedStartTime = { ok: true; time: string } | { ok: false };

export function formatStartTime12h(time: string): {
  clock: string;
  meridiem: Meridiem;
} {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const meridiem: Meridiem = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return {
    clock: `${hour12}:${String(minutes).padStart(2, "0")}`,
    meridiem,
  };
}

function isWithinMatchWindow(hours: number, minutes: number): boolean {
  const totalMinutes = hours * 60 + minutes;
  return (
    totalMinutes >= MATCH_START_HOUR * 60 && totalMinutes <= MATCH_END_HOUR * 60
  );
}

/**
 * Parse 12-hour clock + AM/PM into normalized 24-hour `HH:MM`.
 *
 * Any minute is accepted inside the window. This used to demand half-hour
 * steps, which belonged to a `timeOptions()` list the UI stopped rendering --
 * once the control became a free text field, the rule only survived as an
 * unexplained rejection: a player typing 3:10 was told the time was outside
 * 7:00 AM to 9:00 PM, which it plainly was not. Nothing server-side aligns
 * slots either, and in a pilot where the court is agreed with the club over
 * WhatsApp, 3:10 is a time a club can genuinely give you.
 */
export function parseStartTime12hInput(
  clock: string,
  meridiem: Meridiem,
): ParsedStartTime {
  const trimmed = clock.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return { ok: false };

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12) return { ok: false };
  if (minutes < 0 || minutes > 59) return { ok: false };

  if (meridiem === "AM") {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }

  if (!isWithinMatchWindow(hours, minutes)) return { ok: false };

  return {
    ok: true,
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}
