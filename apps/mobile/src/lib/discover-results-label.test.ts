import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { formatDiscoverResultsLabel } from "./discover-results-label";

/** Echoes the key back so a test asserts which key was chosen, not its wording. */
const t = ((key: string) => key) as unknown as TFunction;

describe("formatDiscoverResultsLabel", () => {
  it("does not claim proximity when no zone restriction is in effect", () => {
    // The regression: this used to be unconditional, so the header read "8
    // players found near you" while the list included players from areas the
    // viewer does not play in.
    expect(formatDiscoverResultsLabel("players", 8, t, false)).toBe(
      "discover.resultsPlayers_other",
    );
    expect(formatDiscoverResultsLabel("matches", 3, t, false)).toBe(
      "discover.resultsMatches_other",
    );
  });

  it("claims proximity only when the results really are zone-restricted", () => {
    expect(formatDiscoverResultsLabel("players", 6, t, true)).toBe(
      "discover.resultsPlayersNear_other",
    );
    expect(formatDiscoverResultsLabel("matches", 2, t, true)).toBe(
      "discover.resultsMatchesNear_other",
    );
  });

  it("uses the singular key for exactly one result", () => {
    expect(formatDiscoverResultsLabel("players", 1, t, false)).toBe(
      "discover.resultsPlayers_one",
    );
    expect(formatDiscoverResultsLabel("players", 1, t, true)).toBe(
      "discover.resultsPlayersNear_one",
    );
    expect(formatDiscoverResultsLabel("matches", 1, t, false)).toBe(
      "discover.resultsMatches_one",
    );
    expect(formatDiscoverResultsLabel("matches", 1, t, true)).toBe(
      "discover.resultsMatchesNear_one",
    );
  });

  it("treats an empty room as plural", () => {
    expect(formatDiscoverResultsLabel("players", 0, t, false)).toBe(
      "discover.resultsPlayers_other",
    );
  });
});
