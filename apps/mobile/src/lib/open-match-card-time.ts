import {
  normalizeOpenMatchProposedTimes,
  openMatchSoonestSlot,
  type OpenMatchCard,
} from "@tennis-lebanon/api";
import { formatCompactUtcInBeirut } from "./beirut-time";

export function openMatchCardDateTimeLabel(match: OpenMatchCard): string | undefined {
  const primary = openMatchSoonestSlot(match.proposed_times);
  if (primary) {
    return formatCompactUtcInBeirut(primary.starts_at);
  }

  const reparsed = openMatchSoonestSlot(
    normalizeOpenMatchProposedTimes(match.proposed_times),
  );
  if (!reparsed) return undefined;

  return formatCompactUtcInBeirut(reparsed.starts_at);
}
