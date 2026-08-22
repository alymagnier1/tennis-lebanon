export type DiscoverTimeWindow = {
  freeFrom: string;
  freeTo: string;
};

type RouteParam = string | string[] | undefined;

function firstString(value: RouteParam): string | null {
  // Expo Router hands back an array when a key appears more than once. Taking
  // the first is arbitrary but harmless; the alternative is rejecting a link
  // that is merely duplicated rather than malformed.
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

/**
 * Reads a `freeFrom`/`freeTo` window off route params.
 *
 * Validated rather than trusted: these arrive through a URL, so they can be
 * absent, duplicated, or nonsense, and `discoverPlayerFiltersSchema` rejects
 * anything that is not an offset datetime. Returning null for all of those
 * lets Discover fall back to its ordinary unfiltered list instead of throwing
 * on a bad link.
 *
 * Normalised to UTC ISO on the way out so the value handed to the RPC has one
 * shape regardless of how the caller wrote it.
 */
export function parseDiscoverTimeWindow(
  params: Record<string, RouteParam>,
): DiscoverTimeWindow | null {
  const from = firstString(params.freeFrom);
  const to = firstString(params.freeTo);
  if (!from || !to) {
    return null;
  }

  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return null;
  }

  // An inverted or empty window would return nobody and read as a broken
  // filter rather than an empty one.
  if (toMs <= fromMs) {
    return null;
  }

  return {
    freeFrom: new Date(fromMs).toISOString(),
    freeTo: new Date(toMs).toISOString(),
  };
}
