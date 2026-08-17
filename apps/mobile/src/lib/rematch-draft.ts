import type { MatchHubCard } from "@tennis-lebanon/api";
import {
  playIntentSchema,
  preferredFormatForPlayer,
  skillBandSchema,
  skillBandsForPlayer,
  skillBandsInRange,
  skillRangeFromSelection,
  visibilityFromListOnDiscover,
  type PlayIntent,
} from "@tennis-lebanon/domain";
import {
  resetCreateMatchDraft,
  updateCreateMatchDraft,
  type Draft,
} from "./create-match-draft";
import { zoneIdsFromPlayerZones } from "./prefill-create-match-for-player";

/**
 * "Play again" — the same match, a new hour.
 *
 * Recreational tennis is overwhelmingly repeat-partner, and the moment a match
 * closes out is the only one where both players have just agreed they enjoyed
 * it. Offering the next match there costs a tap; asking them to rebuild it from
 * the Create tab a week later costs the whole flow, which is where the second
 * match goes to die.
 *
 * The draft this produces is the invite-a-player draft (`inviteForPlayer` +
 * `targetPlayerId`), so `match/create/index` skips host-default hydration and
 * lands on the schedule step with everything but the time already filled.
 */

export type RematchOpponent = {
  userId: string;
  displayName: string;
};

type HubParticipantLike = {
  user_id: string;
  display_name: string;
  status: string;
};

/**
 * Attendance values that leave a rematch honest. `unknown` is included on
 * purpose: a match can complete on the 72-hour grace window without this
 * viewer ever answering (see M9.1), and they still played.
 */
const REMATCHABLE_ATTENDANCE = new Set(["attended", "unknown"]);

function isHubParticipant(value: unknown): value is HubParticipantLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.user_id === "string" &&
    typeof record.display_name === "string" &&
    typeof record.status === "string"
  );
}

export function resolveRematchOpponents(
  participants: unknown,
  viewerUserId: string,
): RematchOpponent[] {
  if (!Array.isArray(participants)) {
    return [];
  }

  return participants
    .filter(isHubParticipant)
    .filter(
      (participant) =>
        participant.status === "accepted" &&
        participant.user_id !== viewerUserId,
    )
    .map((participant) => ({
      userId: participant.user_id,
      displayName: participant.display_name,
    }));
}

export function canOfferRematch(input: {
  matchStatus: string;
  viewerStatus: string | null;
  viewerAttendance: string | null | undefined;
  opponentCount: number;
}): boolean {
  return (
    input.matchStatus === "completed" &&
    input.viewerStatus === "accepted" &&
    REMATCHABLE_ATTENDANCE.has(input.viewerAttendance ?? "unknown") &&
    input.opponentCount > 0
  );
}

export type RematchHubFields = Pick<
  MatchHubCard,
  "format" | "intent" | "min_skill" | "max_skill" | "zones"
>;

export function buildRematchDraft(
  hub: RematchHubFields,
  opponent: RematchOpponent,
): Draft {
  const parsedMin = skillBandSchema.safeParse(hub.min_skill);
  const parsedMax = skillBandSchema.safeParse(hub.max_skill);
  // A band this build does not recognise means an app older than the database.
  // Falling back to a window around intermediate matches the invite-a-player
  // prefill rather than inventing a range the host never chose.
  const selectedSkillBands =
    parsedMin.success && parsedMax.success
      ? skillBandsInRange(parsedMin.data, parsedMax.data)
      : skillBandsForPlayer("intermediate");
  const { minSkill, maxSkill } = skillRangeFromSelection(selectedSkillBands);

  const parsedIntent = playIntentSchema.safeParse(hub.intent);
  const intent: PlayIntent = parsedIntent.success
    ? parsedIntent.data
    : "either";

  return {
    format: preferredFormatForPlayer(
      hub.format === "doubles" ? "doubles" : "singles",
    ),
    intent,
    minSkill,
    maxSkill,
    selectedSkillBands,
    visibility: visibilityFromListOnDiscover(false),
    requiresCreatorApproval: false,
    zoneIds: zoneIdsFromPlayerZones(hub.zones),
    // Deliberately no `proposedTimes`: the old match's hour is in the past, and
    // `createMatchInputSchema` rejects it. Picking the new time is the one
    // decision a rematch genuinely has to make.
    timingMode: "fixed",
    targetPlayerId: opponent.userId,
    targetPlayerName: opponent.displayName,
  };
}

export function beginRematch(
  hub: RematchHubFields,
  opponent: RematchOpponent,
): void {
  resetCreateMatchDraft();
  updateCreateMatchDraft({
    ...buildRematchDraft(hub, opponent),
    inviteForPlayer: true,
  });
}
