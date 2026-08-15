import type { MatchPreferredClub } from "@tennis-lebanon/api";
import type { Json } from "@tennis-lebanon/types";
import { zoneLabelFromList, zoneNameFromJson } from "./zones";

/**
 * The clubs a host named at creation, joined for display.
 *
 * Club names are plain text rather than localized like zone names, so this is
 * simpler than {@link zoneLabelFromList} — but it takes the same defensive
 * stance on shape, since the value arrives as `jsonb` from the hub and
 * discovery RPCs.
 */
export function clubLabelFromList(clubs: unknown): string {
  if (!Array.isArray(clubs) || clubs.length === 0) return "";
  return clubs
    .map((club) => (club as MatchPreferredClub).name ?? "")
    .filter(Boolean)
    .join(" · ");
}

export function clubIdsFromList(clubs: unknown): string[] {
  if (!Array.isArray(clubs)) return [];
  return clubs
    .map((club) => (club as MatchPreferredClub).club_id ?? "")
    .filter(Boolean);
}

/** Public address first; zone if the club has no street line yet. */
export function preferredClubLocationLabel(input: {
  addressPublic?: string | null;
  zoneNameI18n?: Json;
  locale: string;
}): string | null {
  const address = input.addressPublic?.trim();
  if (address) return address;
  const zone = zoneNameFromJson(input.zoneNameI18n ?? null, input.locale);
  return zone || null;
}

/**
 * Club chip for Matches / Home cards: booked venue wins, then preferred clubs,
 * then a generic "court secured" fallback when the list has no club name yet.
 */
export function matchCardClubLabel(input: {
  clubName?: string | null;
  preferredClubs?: unknown;
  hasCourt?: boolean;
  courtSecuredFallback?: string;
}): string | undefined {
  const booked = input.clubName?.trim();
  if (booked) return booked;

  const preferred = clubLabelFromList(input.preferredClubs);
  if (preferred) return preferred;

  if (input.hasCourt && input.courtSecuredFallback) {
    return input.courtSecuredFallback;
  }

  return undefined;
}

/** Area chip from match zones; empty when the match has none. */
export function matchCardAreaLabel(
  zones: unknown,
  locale: string,
): string | undefined {
  const label = zoneLabelFromList(zones, locale);
  return label || undefined;
}
