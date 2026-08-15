import type { CompatiblePlayerCard, OpenMatchCard } from "@tennis-lebanon/api";
import { SKILL_BAND_RANK, type SkillBand } from "@tennis-lebanon/domain";

export const DISCOVER_SORT_MODES = [
  "recommended",
  "level",
  "area",
  "availability",
] as const;

export type DiscoverSortMode = (typeof DISCOVER_SORT_MODES)[number];

export const DEFAULT_DISCOVER_SORT: DiscoverSortMode = "recommended";

type DiscoverSortable = {
  level_fit: boolean;
  zone_overlap: boolean;
  availability_overlap: boolean;
};

function compareBooleanDesc(left: boolean, right: boolean): number {
  return Number(right) - Number(left);
}

function skillDistance(viewerBand: SkillBand, candidateBand: string): number {
  const viewerRank = SKILL_BAND_RANK[viewerBand];
  const candidateRank = SKILL_BAND_RANK[candidateBand as SkillBand];
  if (viewerRank == null || candidateRank == null) return 99;
  return Math.abs(viewerRank - candidateRank);
}

function compareDiscoverSortables(
  left: DiscoverSortable,
  right: DiscoverSortable,
  sort: Exclude<DiscoverSortMode, "recommended">,
  levelDistance?: (card: DiscoverSortable) => number,
): number {
  if (sort === "level") {
    const byFit = compareBooleanDesc(left.level_fit, right.level_fit);
    if (byFit !== 0) return byFit;
    if (levelDistance) {
      const byDistance = levelDistance(left) - levelDistance(right);
      if (byDistance !== 0) return byDistance;
    }
    return 0;
  }

  if (sort === "area") {
    return compareBooleanDesc(left.zone_overlap, right.zone_overlap);
  }

  return compareBooleanDesc(
    left.availability_overlap,
    right.availability_overlap,
  );
}

/** Re-order discover player rows without changing the filter query. */
export function sortDiscoverPlayers(
  players: CompatiblePlayerCard[],
  sort: DiscoverSortMode,
  viewerSkillBand?: string | null,
): CompatiblePlayerCard[] {
  if (sort === "recommended" || players.length < 2) return players;

  const viewerBand =
    viewerSkillBand && viewerSkillBand in SKILL_BAND_RANK
      ? (viewerSkillBand as SkillBand)
      : null;

  return [...players].sort((left, right) => {
    const primary = compareDiscoverSortables(
      left,
      right,
      sort,
      viewerBand
        ? (card) =>
            skillDistance(
              viewerBand,
              (card as CompatiblePlayerCard).skill_band,
            )
        : undefined,
    );
    if (primary !== 0) return primary;

    if (sort === "availability") {
      const leftStart = left.overlap_starts_at ?? "\uffff";
      const rightStart = right.overlap_starts_at ?? "\uffff";
      if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
    }

    return left.display_name.localeCompare(right.display_name);
  });
}

/** Same sort keys as players, using open-match fit flags. */
export function sortDiscoverMatches(
  matches: OpenMatchCard[],
  sort: DiscoverSortMode,
): OpenMatchCard[] {
  if (sort === "recommended" || matches.length < 2) return matches;

  return [...matches].sort((left, right) => {
    const primary = compareDiscoverSortables(left, right, sort);
    if (primary !== 0) return primary;
    return left.created_at < right.created_at
      ? 1
      : left.created_at > right.created_at
        ? -1
        : 0;
  });
}
