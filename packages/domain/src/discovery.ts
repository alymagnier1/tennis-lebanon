import { z } from "zod";
import { playIntentSchema, type SkillBand } from "./onboarding";

export const SKILL_BAND_RANK: Record<SkillBand, number> = {
  beginner: 1,
  improving: 2,
  intermediate: 3,
  advanced: 4,
  competitive: 5,
};

export const MIN_OVERLAP_MINUTES = 60;
export const DEFAULT_DISCOVERY_HORIZON_DAYS = 14;
export const MAX_DISCOVERY_HORIZON_DAYS = 28;
export const DEFAULT_LEVEL_WINDOW = 1;
export const WIDENED_LEVEL_WINDOW = 2;

export const matchFormatSchema = z.enum(["singles", "doubles"]);

export const discoveryFiltersSchema = z.object({
  zoneIds: z.array(z.string().uuid()).optional(),
  format: matchFormatSchema.nullable().optional(),
  intent: playIntentSchema.nullable().optional(),
  requireAvailabilityOverlap: z.boolean().default(true),
  horizonDays: z
    .number()
    .int()
    .min(1)
    .max(MAX_DISCOVERY_HORIZON_DAYS)
    .default(DEFAULT_DISCOVERY_HORIZON_DAYS),
  levelWindow: z.number().int().min(0).max(4).default(DEFAULT_LEVEL_WINDOW),
  limit: z.number().int().min(1).max(50).default(20),
});

export type DiscoveryFilters = z.infer<typeof discoveryFiltersSchema>;
export type DiscoveryFiltersInput = Partial<DiscoveryFilters>;

export type TimeInterval = {
  startsAt: Date;
  endsAt: Date;
};

export type RecurringAvailabilityWindow = {
  weekday: number;
  localStartMinutes: number;
  localEndMinutes: number;
  timezone: string;
  validFrom?: string | null;
  validUntil?: string | null;
};

export function skillBandRank(band: SkillBand): number {
  return SKILL_BAND_RANK[band];
}

export function isWithinLevelWindow(
  viewerBand: SkillBand,
  candidateBand: SkillBand,
  window: number,
): boolean {
  return (
    Math.abs(skillBandRank(viewerBand) - skillBandRank(candidateBand)) <= window
  );
}

export function widenLevelWindow(currentWindow: number): number {
  return currentWindow < WIDENED_LEVEL_WINDOW
    ? WIDENED_LEVEL_WINDOW
    : currentWindow;
}

export function overlapMinutes(a: TimeInterval, b: TimeInterval): number {
  const start = Math.max(a.startsAt.getTime(), b.startsAt.getTime());
  const end = Math.min(a.endsAt.getTime(), b.endsAt.getTime());
  if (end <= start) return 0;
  return (end - start) / 60_000;
}

export function hasMinimumOverlap(
  a: TimeInterval,
  b: TimeInterval,
  minimumMinutes = MIN_OVERLAP_MINUTES,
): boolean {
  return overlapMinutes(a, b) >= minimumMinutes;
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function zonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    weekday: weekdayMap[lookup.weekday ?? "Sun"] ?? 0,
  };
}

function zonedInstant(
  year: number,
  month: number,
  day: number,
  minutesFromMidnight: number,
  timeZone: string,
): Date {
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = zonedDateParts(utcGuess, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hour,
    minute,
    0,
  );
  const offset = asUtc - utcGuess.getTime();
  return new Date(asUtc - offset);
}

export function expandRecurringAvailability(
  windows: RecurringAvailabilityWindow[],
  rangeStart: Date,
  rangeEnd: Date,
): TimeInterval[] {
  const intervals: TimeInterval[] = [];
  const cursor = new Date(rangeStart);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= rangeEnd) {
    const parts = zonedDateParts(cursor, "Asia/Beirut");
    const dayKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

    for (const window of windows) {
      if (window.weekday !== parts.weekday) continue;
      if (window.validFrom && dayKey < window.validFrom) continue;
      if (window.validUntil && dayKey > window.validUntil) continue;

      const startsAt = zonedInstant(
        parts.year,
        parts.month,
        parts.day,
        window.localStartMinutes,
        window.timezone,
      );
      const endsAt = zonedInstant(
        parts.year,
        parts.month,
        parts.day,
        window.localEndMinutes,
        window.timezone,
      );
      if (endsAt <= rangeStart || startsAt >= rangeEnd) continue;
      intervals.push({
        startsAt: startsAt < rangeStart ? rangeStart : startsAt,
        endsAt: endsAt > rangeEnd ? rangeEnd : endsAt,
      });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return intervals;
}

export function recurringWindowFromTimes(input: {
  weekday: number;
  localStart: string;
  localEnd: string;
  timezone?: string;
  validFrom?: string | null;
  validUntil?: string | null;
}): RecurringAvailabilityWindow {
  return {
    weekday: input.weekday,
    localStartMinutes: parseTimeToMinutes(input.localStart),
    localEndMinutes: parseTimeToMinutes(input.localEnd),
    timezone: input.timezone ?? "Asia/Beirut",
    validFrom: input.validFrom,
    validUntil: input.validUntil,
  };
}
