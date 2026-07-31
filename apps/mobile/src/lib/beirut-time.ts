const BEIRUT_TIME_ZONE = "Asia/Beirut";

function parseTimeParts(value: string): { hours: number; minutes: number } {
  const [hours, minutes] = value.split(":").map(Number);
  return {
    hours: hours ?? 0,
    minutes: minutes ?? 0,
  };
}

function zonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
  };
}

export function beirutLocalToUtcIso(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const { hours, minutes } = parseTimeParts(time);
  const utcGuess = new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hours, minutes, 0),
  );
  const parts = zonedDateParts(utcGuess, BEIRUT_TIME_ZONE);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hours,
    minutes,
    0,
  );
  const offset = asUtc - utcGuess.getTime();
  return new Date(asUtc - offset).toISOString();
}

export function formatUtcInBeirut(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: BEIRUT_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatUtcSlotInBeirut(
  startIso: string,
  endIso: string,
): string {
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: BEIRUT_TIME_ZONE,
    month: "short",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: BEIRUT_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });

  const start = new Date(startIso);
  const end = new Date(endIso);
  const startDate = dateFormatter.format(start);
  const endDate = dateFormatter.format(end);
  const startTime = timeFormatter.format(start);
  const endTime = timeFormatter.format(end);

  if (startDate === endDate) {
    return `${startDate}, ${startTime}–${endTime}`;
  }

  return `${startDate} ${startTime} – ${endDate} ${endTime}`;
}
