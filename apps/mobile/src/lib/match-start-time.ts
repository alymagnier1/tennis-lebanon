/** Half-hour steps across the window a club is plausibly open. */
export const MATCH_START_HOUR = 7;
export const MATCH_END_HOUR = 21;

export type Meridiem = "AM" | "PM";
export type ParsedStartTime = { ok: true; time: string } | { ok: false };

/** `HH:MM` in half-hour steps between {@link MATCH_START_HOUR} and {@link MATCH_END_HOUR}. */
export function timeOptions(): string[] {
  const out: string[] = [];
  for (let hour = MATCH_START_HOUR; hour <= MATCH_END_HOUR; hour += 1) {
    out.push(`${String(hour).padStart(2, "0")}:00`);
    if (hour !== MATCH_END_HOUR) {
      out.push(`${String(hour).padStart(2, "0")}:30`);
    }
  }
  return out;
}

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

/** Parse 12-hour clock + AM/PM into normalized 24-hour `HH:MM`. */
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
  if (minutes < 0 || minutes > 59 || minutes % 30 !== 0) return { ok: false };

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

/** @deprecated Use parseStartTime12hInput */
export function parseStartTimeInput(value: string): ParsedStartTime {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return { ok: false };

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes < 0 || minutes > 59 || minutes % 30 !== 0) return { ok: false };
  if (!isWithinMatchWindow(hours, minutes)) return { ok: false };

  return {
    ok: true,
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}
