import type { TFunction } from "i18next";
import {
  formatOwnRatingStatValue,
  isProvisionalPlayerRating,
} from "@tennis-lebanon/domain";

const FALLBACKS = {
  profileScreenEdit: "Edit",
  profileScreenAboutTitle: "About me",
  profileScreenBioPlaceholder: "Tell players how you like to play (optional)",
  profileScreenMatchesStat: "Played matches",
  profileScreenTennisPrefsTitle: "Tennis preferences",
  profileScreenPlayIntent: "Play intent",
  profileScreenMatchFormats: "Match formats",
  profileScreenPreferredAreasTitle: "Preferred areas",
  profileScreenZonesError: "Choose at least one area.",
} as const;

type ProfileScreenKey = keyof typeof FALLBACKS;

function tr(t: TFunction, key: ProfileScreenKey): string {
  const value = t(key);
  return value === key ? FALLBACKS[key] : value;
}

export function profileScreenEditLabel(t: TFunction): string {
  return tr(t, "profileScreenEdit");
}

export function profileScreenAboutTitle(t: TFunction): string {
  return tr(t, "profileScreenAboutTitle");
}

export function profileScreenBioPlaceholder(t: TFunction): string {
  return tr(t, "profileScreenBioPlaceholder");
}

export function profileScreenMatchesStatLabel(
  _count: number,
  t: TFunction,
): string {
  return tr(t, "profileScreenMatchesStat");
}

export function profileScreenTennisPrefsTitle(t: TFunction): string {
  return tr(t, "profileScreenTennisPrefsTitle");
}

export function profileScreenPlayIntentLabel(t: TFunction): string {
  return tr(t, "profileScreenPlayIntent");
}

export function profileScreenMatchFormatsLabel(t: TFunction): string {
  return tr(t, "profileScreenMatchFormats");
}

export function profileScreenPreferredAreasTitle(t: TFunction): string {
  return tr(t, "profileScreenPreferredAreasTitle");
}

export function profileScreenZonesError(t: TFunction): string {
  return tr(t, "profileScreenZonesError");
}

export function profileScreenRatingStatValue(
  ratedMatchCount: number,
  internalRating: number,
): string {
  return formatOwnRatingStatValue({ ratedMatchCount, internalRating }).value;
}

export function profileScreenRatingStatHint(
  ratedMatchCount: number,
  t: TFunction,
): string | null {
  if (!isProvisionalPlayerRating(ratedMatchCount)) return null;
  const value = t("profileScreenRatingBuilding");
  return value === "profileScreenRatingBuilding" ? "Building rating" : value;
}
