/**
 * Pilot marketing tiles for cities that are not live yet.
 *
 * Live zones still come from the API. These names are only shown when the
 * matching English label is absent, so inserting Tripoli as a real zone does
 * not produce both a selectable card and a "coming soon" card.
 */
export const UPCOMING_ONBOARDING_ZONES = [
  { id: "upcoming-tripoli", englishName: "Tripoli", nameKey: "onboarding.zones.upcomingTripoli" },
  { id: "upcoming-saida", englishName: "Saida", nameKey: "onboarding.zones.upcomingSaida" },
] as const;

export function upcomingZonesToShow(liveEnglishNames: string[]) {
  const live = new Set(
    liveEnglishNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  return UPCOMING_ONBOARDING_ZONES.filter(
    (zone) => !live.has(zone.englishName.toLowerCase()),
  );
}
