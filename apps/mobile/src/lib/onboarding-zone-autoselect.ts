/**
 * Whether the zones onboarding step should fill itself in.
 *
 * The pilot ships exactly one active zone — `supabase/pilot/beirut-zones.sql`
 * inserts a single row and launch task 1.6 requires its final query to report
 * exactly one. With one option the step asks a question that has only one
 * answer, and `Continue` stays disabled until the player taps it, so it costs a
 * tap and teaches nothing.
 *
 * Returns the ids to select, or `null` to leave the selection alone. Two guards
 * matter: a player who has already chosen is never overwritten (so returning to
 * the step does not clobber a deliberate choice), and more than one zone always
 * means a real question, which is the state after the pilot widens beyond one
 * area.
 */
export function autoSelectedZoneIds(input: {
  availableZoneIds: string[];
  selectedZoneIds: string[];
}): string[] | null {
  if (input.selectedZoneIds.length > 0) {
    return null;
  }

  if (input.availableZoneIds.length !== 1) {
    return null;
  }

  const [only] = input.availableZoneIds;

  return only ? [only] : null;
}
