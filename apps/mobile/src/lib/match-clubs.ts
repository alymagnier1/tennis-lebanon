import type { MatchPreferredClub } from "@tennis-lebanon/api";
import type { Json } from "@tennis-lebanon/types";
import { zoneNameFromJson } from "./zones";

/**
 * The clubs a host named at creation, joined for display.
 *
 * Club names are plain text rather than localized like zone names, so this is
 * simpler than zone labels — but it takes the same defensive stance on shape,
 * since the value arrives as `jsonb` from the hub and discovery RPCs.
 */
export function clubNamesFromList(clubs: unknown): string[] {
  if (!Array.isArray(clubs) || clubs.length === 0) return [];
  return clubs
    .map((club) => (club as MatchPreferredClub).name ?? "")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function clubLabelFromList(clubs: unknown): string {
  return clubNamesFromList(clubs).join(" · ");
}

/** First label, plus "+N" when the list is longer — keeps match cards scannable. */
export function compactJoinedLabel(
  parts: string[],
  maxVisible = 1,
): string | undefined {
  const clean = parts.map((part) => part.trim()).filter(Boolean);
  if (clean.length === 0) return undefined;
  if (clean.length <= maxVisible) {
    return clean.join(" · ");
  }
  const shown = clean.slice(0, maxVisible).join(" · ");
  return `${shown} +${clean.length - maxVisible}`;
}

/** Smaller type when several names must share one footer line. */
export function joinedListTypeSize(count: number): {
  fontSize: number;
  lineHeight: number;
} {
  if (count >= 3) return { fontSize: 10, lineHeight: 13 };
  if (count === 2) return { fontSize: 12, lineHeight: 16 };
  return { fontSize: 14, lineHeight: 18 };
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
  /** Shorten multi-club lists to "Club +N" for dense cards. */
  compact?: boolean;
}): string | undefined {
  const booked = input.clubName?.trim();
  if (booked) return booked;

  const names = clubNamesFromList(input.preferredClubs);
  if (names.length > 0) {
    return input.compact ? compactJoinedLabel(names) : names.join(" · ");
  }

  if (input.hasCourt && input.courtSecuredFallback) {
    return input.courtSecuredFallback;
  }

  return undefined;
}

/** Area chip from match zones; empty when the match has none. */
export function matchCardAreaLabel(
  zones: unknown,
  locale: string,
  options?: { compact?: boolean },
): string | undefined {
  if (!Array.isArray(zones) || zones.length === 0) return undefined;
  const labels = zones
    .map((zone) => {
      const entry = zone as {
        name_i18n?: Record<string, string>;
        slug?: string;
      };
      return (
        entry.name_i18n?.[locale] ??
        entry.name_i18n?.en ??
        entry.slug ??
        ""
      ).trim();
    })
    .filter(Boolean);
  if (labels.length === 0) return undefined;
  if (options?.compact) return compactJoinedLabel(labels);
  return labels.join(" · ");
}

/**
 * Zones the host advertised that none of their chosen clubs sit in.
 *
 * `zoneIds` has `min(1)` and no maximum while `preferredClubIds` caps at three,
 * so a host can list three areas with every club in one of them — and a player
 * joining on the strength of an area finds the venue is somewhere else. Warn at
 * creation rather than narrowing the zone list on cards: narrowing would
 * silently rewrite what the host chose, and would also change how matches
 * published before this read.
 *
 * Empty when no club is chosen at all. That is the ordinary state of an
 * `invite_only` match — clubs are only required for `public` ones — and
 * flagging every zone there would be a warning the host cannot act on.
 */
export function zonesWithoutPreferredClub(input: {
  zoneOptions: { value: string; label: string }[];
  selectedZoneIds: string[];
  clubs: { club_id: string; zone_id: string }[];
  selectedClubIds: string[];
}): string[] {
  if (input.selectedClubIds.length === 0) return [];

  const chosen = new Set(input.selectedClubIds);
  const coveredZoneIds = new Set(
    input.clubs
      .filter((club) => chosen.has(club.club_id))
      .map((club) => club.zone_id),
  );

  return input.selectedZoneIds
    .filter((zoneId) => !coveredZoneIds.has(zoneId))
    .map(
      (zoneId) =>
        input.zoneOptions.find((option) => option.value === zoneId)?.label ??
        "",
    )
    .map((label) => label.trim())
    .filter(Boolean);
}
