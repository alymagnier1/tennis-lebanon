import type { CompatiblePlayerCard } from "@tennis-lebanon/api";

export type DiscoverSortMode = "recommended" | "level" | "zone";

export function sortCompatiblePlayers(
  players: CompatiblePlayerCard[],
  mode: DiscoverSortMode,
): CompatiblePlayerCard[] {
  if (mode === "recommended") return players;

  return [...players].sort((left, right) => {
    if (mode === "level") {
      return Number(right.level_fit) - Number(left.level_fit);
    }

    return Number(right.zone_overlap) - Number(left.zone_overlap);
  });
}
