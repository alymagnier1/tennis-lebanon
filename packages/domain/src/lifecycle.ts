export const MATCH_MAX_OPEN_DAYS = 7;
export const MATCH_EXPIRY_GRACE_HOURS = 24;
export const MATCH_STALE_WARNING_DAYS = 2;

export function canExtendMatchListing(input: {
  isCreator: boolean;
  matchStatus: string;
  isStaleWarning: boolean;
}): boolean {
  return (
    input.isCreator &&
    ["open", "full"].includes(input.matchStatus) &&
    input.isStaleWarning
  );
}
