export const PILOT_CRITICAL_FLOWS = [
  "auth.magicLink",
  "onboarding.profile",
  "discover.players",
  "discover.matches",
  "match.create",
  "match.hub",
  "match.book",
  "match.chat",
  "match.result",
  "matches.list",
  "profile.availability",
  "clubs.directory",
  "player.report",
  "settings.locale",
] as const;

export type PilotCriticalFlow = (typeof PILOT_CRITICAL_FLOWS)[number];

export function isPilotCriticalFlow(value: string): value is PilotCriticalFlow {
  return (PILOT_CRITICAL_FLOWS as readonly string[]).includes(value);
}
