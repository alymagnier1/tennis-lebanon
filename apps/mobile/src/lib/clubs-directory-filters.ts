export function filterClubsDirectory<
  T extends { name: string; amenities: string[] },
>(clubs: T[], search: string, zoneLabel: (club: T) => string): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return clubs;

  return clubs.filter((club) => {
    if (club.name.toLowerCase().includes(query)) return true;
    if (zoneLabel(club).toLowerCase().includes(query)) return true;
    return club.amenities.some((amenity) =>
      amenity.toLowerCase().replace(/_/g, " ").includes(query),
    );
  });
}
