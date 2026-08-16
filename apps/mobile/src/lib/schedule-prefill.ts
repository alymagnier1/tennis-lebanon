const MAX_PREFERRED_CLUBS = 3;

export function seedZoneIdsFromProfile(
  draftZoneIds: string[] | undefined,
  profileZoneIds: string[],
  activeZoneIds: string[],
): string[] {
  const active = new Set(activeZoneIds);
  if (draftZoneIds?.length) {
    return draftZoneIds.filter((id) => active.has(id));
  }
  return profileZoneIds.filter((id) => active.has(id));
}

export function seedFavoriteClubIds(
  draftClubIds: string[] | undefined,
  favoriteClubIds: string[],
  max = MAX_PREFERRED_CLUBS,
): string[] {
  if (draftClubIds?.length) {
    return draftClubIds.slice(0, max);
  }
  return favoriteClubIds.slice(0, max);
}

export function favoriteClubIdsFromDirectory(
  clubs: { club_id: string; is_favorite: boolean }[],
): string[] {
  return clubs.filter((club) => club.is_favorite).map((club) => club.club_id);
}

/**
 * Whether the "Where" section knows enough to decide between its summary and
 * its editor.
 *
 * Before the zones and the club directory have both settled, no club is
 * selected yet even for a host whose favourites are about to seed. Deciding
 * then opens the editor and collapses it a moment later.
 */
export function whereSectionHydrated(input: {
  zonesHydrated: boolean;
  clubsHydrated: boolean;
  clubsSettled: boolean;
}): boolean {
  return input.zonesHydrated && (input.clubsHydrated || input.clubsSettled);
}

/**
 * Keep the Where editor open until Done. Incomplete selections force it open;
 * once the host is editing, the first club that makes the summary "ready" must
 * not snap the panel shut — they may still want a second or third club.
 */
export function shouldShowWhereEditor(input: {
  editingWhere: boolean;
  whereHydrated: boolean;
  whereSummaryReady: boolean;
}): boolean {
  return (
    input.editingWhere ||
    (input.whereHydrated && !input.whereSummaryReady)
  );
}

/** Promote incomplete forced-open into explicit edit so Done owns collapse. */
export function shouldPromoteWhereEditing(input: {
  editingWhere: boolean;
  whereHydrated: boolean;
  whereSummaryReady: boolean;
}): boolean {
  return (
    !input.editingWhere &&
    input.whereHydrated &&
    !input.whereSummaryReady
  );
}

/**
 * Whether the clubs a host just published with should become their favourites.
 *
 * Only when they have none: nothing seeded the picker, so they chose by hand
 * and would keep choosing by hand on every future create. A host who already
 * curated favourites keeps exactly the ones they picked.
 */
export function shouldSeedFavoriteClubs(
  clubs: { club_id: string; is_favorite: boolean }[] | undefined,
): boolean {
  return favoriteClubIdsFromDirectory(clubs ?? []).length === 0;
}
