export const PROVISIONAL_RATING_MATCH_THRESHOLD = 5;

export function isProvisionalPlayerRating(
  ratedMatchCount: number,
  threshold = PROVISIONAL_RATING_MATCH_THRESHOLD,
): boolean {
  return ratedMatchCount < threshold;
}

export function formatPublicPlayerLevelLabel(input: {
  skillBand: string;
  displayRating: number | null;
  provisionalRatingLabel?: string | null;
  translateSkillBand: (skillBand: string) => string;
  translateProvisional: () => string;
}): string {
  const band = input.translateSkillBand(input.skillBand);

  if (input.displayRating != null) {
    return `${band} · ${input.displayRating}`;
  }

  if (input.provisionalRatingLabel === "provisional") {
    return `${band} · ${input.translateProvisional()}`;
  }

  return band;
}

export function formatOwnRatingHeadline(input: {
  ratedMatchCount: number;
  internalRating: number;
  threshold?: number;
  translateEarned: (value: number) => string;
  translateProvisional: (count: number, threshold: number) => string;
}): string {
  const threshold = input.threshold ?? PROVISIONAL_RATING_MATCH_THRESHOLD;

  if (isProvisionalPlayerRating(input.ratedMatchCount, threshold)) {
    return input.translateProvisional(input.ratedMatchCount, threshold);
  }

  return input.translateEarned(input.internalRating);
}

/** Compact value for profile stat chips — avoids long provisional copy. */
export function formatOwnRatingStatValue(input: {
  ratedMatchCount: number;
  internalRating: number;
  threshold?: number;
}): { value: string; isProvisional: boolean } {
  const threshold = input.threshold ?? PROVISIONAL_RATING_MATCH_THRESHOLD;

  if (isProvisionalPlayerRating(input.ratedMatchCount, threshold)) {
    return {
      value: `${input.ratedMatchCount}/${threshold}`,
      isProvisional: true,
    };
  }

  return {
    value: String(Math.round(input.internalRating)),
    isProvisional: false,
  };
}
