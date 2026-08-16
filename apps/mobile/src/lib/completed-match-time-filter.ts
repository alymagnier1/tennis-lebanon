/** Completed-tab windows — rolling from now, not calendar months. */
export const COMPLETED_TIME_FILTERS = [
  "week",
  "month",
  "three_months",
  "all",
] as const;

export type CompletedTimeFilter = (typeof COMPLETED_TIME_FILTERS)[number];

export const DEFAULT_COMPLETED_TIME_FILTER: CompletedTimeFilter = "all";

const DAY_MS = 24 * 60 * 60 * 1000;

export function completedTimeFilterTabKey(filter: CompletedTimeFilter): string {
  switch (filter) {
    case "week":
      return "matches.list.completedFilter.week";
    case "month":
      return "matches.list.completedFilter.month";
    case "three_months":
      return "matches.list.completedFilter.threeMonths";
    case "all":
      return "matches.list.completedFilter.all";
  }
}

export function completedTimeFilterEmptyTitleKey(
  filter: CompletedTimeFilter,
): string {
  return filter === "all"
    ? "matches.list.completedEmptyTitle"
    : "matches.list.completedFilterEmptyTitle";
}

export function completedTimeFilterEmptyBodyKey(
  filter: CompletedTimeFilter,
): string {
  return filter === "all"
    ? "matches.list.completedEmpty"
    : "matches.list.completedFilterEmpty";
}

/** Instant before which matches are excluded. `null` = no cutoff. */
export function completedTimeFilterCutoff(
  filter: CompletedTimeFilter,
  now: Date = new Date(),
): Date | null {
  switch (filter) {
    case "all":
      return null;
    case "week":
      return new Date(now.getTime() - 7 * DAY_MS);
    case "month":
      return new Date(now.getTime() - 30 * DAY_MS);
    case "three_months":
      return new Date(now.getTime() - 90 * DAY_MS);
  }
}

export function completedMatchOccurredAt(match: {
  played_at?: string | null;
  completed_at: string;
}): string {
  return match.played_at ?? match.completed_at;
}

export function filterCompletedMatchesByTime<
  T extends { played_at?: string | null; completed_at: string },
>(matches: T[], filter: CompletedTimeFilter, now: Date = new Date()): T[] {
  const cutoff = completedTimeFilterCutoff(filter, now);
  if (!cutoff) return matches;

  const cutoffMs = cutoff.getTime();
  return matches.filter((match) => {
    const at = Date.parse(completedMatchOccurredAt(match));
    return Number.isFinite(at) && at >= cutoffMs;
  });
}
