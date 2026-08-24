import { z } from "zod";
import { matchFormatSchema } from "./discovery";
import {
  playIntentSchema,
  skillBandSchema,
  databaseUuidSchema,
  type SkillBand,
} from "./onboarding";

export const matchVisibilitySchema = z.enum([
  "public",
  "invite_only",
  "private",
]);

export const proposedTimeSchema = z.object({
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
});

/**
 * `fixed` is the default: the host names one time and joining is consent to
 * it. `flexible` keeps the older unanimous-vote flow for groups that want to
 * negotiate a slot.
 */
export const timingModeSchema = z.enum(["fixed", "flexible"]);
export type TimingMode = z.infer<typeof timingModeSchema>;

export const createMatchInputSchema = z
  .object({
    format: matchFormatSchema,
    visibility: matchVisibilitySchema.default("public"),
    intent: playIntentSchema.default("either"),
    minSkill: skillBandSchema,
    maxSkill: skillBandSchema,
    requiresCreatorApproval: z.boolean().default(false),
    notes: z.string().trim().max(500).optional(),
    zoneIds: z.array(databaseUuidSchema).min(1),
    preferredClubIds: z.array(databaseUuidSchema).max(3).default([]),
    proposedTimes: z.array(proposedTimeSchema).min(1).max(3),
    timingMode: timingModeSchema.default("fixed"),
  })
  .superRefine((value, ctx) => {
    // A public listing that names only a zone leaves a joiner deciding whether
    // to drive without knowing where. Private and invite-only matches are among
    // people who already know, so they may fall back to zones.
    if (value.visibility === "public" && value.preferredClubIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A public match needs at least one preferred club",
        path: ["preferredClubIds"],
      });
    }

    if (value.timingMode === "fixed" && value.proposedTimes.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A fixed match needs exactly one time",
        path: ["proposedTimes"],
      });
    }
    const ranks: Record<SkillBand, number> = {
      beginner: 1,
      improving: 2,
      intermediate: 3,
      advanced: 4,
      competitive: 5,
    };
    if (ranks[value.minSkill] > ranks[value.maxSkill]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minSkill must be less than or equal to maxSkill",
        path: ["minSkill"],
      });
    }

    const now = Date.now();
    for (const [index, slot] of value.proposedTimes.entries()) {
      const endsAt = new Date(slot.endsAt).getTime();
      const startsAt = new Date(slot.startsAt).getTime();
      if (endsAt <= startsAt || endsAt <= now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Proposed times must be in the future",
          path: ["proposedTimes", index],
        });
      }
    }
  });

export type CreateMatchInput = z.infer<typeof createMatchInputSchema>;
export type ProposedTimeInput = z.infer<typeof proposedTimeSchema>;
export type MatchVisibility = z.infer<typeof matchVisibilitySchema>;

export function visibilityFromListOnDiscover(
  listOnDiscover: boolean,
): MatchVisibility {
  return listOnDiscover ? "public" : "invite_only";
}

/**
 * Accepts a plain string because RPC payloads type `visibility` as text.
 * Only "public" is listed, so an unrecognised value correctly reads as not
 * listed rather than forcing a cast at every call site.
 */
export function listOnDiscoverFromVisibility(
  visibility: string | null | undefined,
): boolean {
  return visibility === "public";
}

export const INVITE_TOKEN_HASH_ALGORITHM =
  "Server-side SHA-256 hex digest via extensions.digest; clients never persist raw tokens after share.";

export const LEAVE_POLICY_COPY_KEY = "matches.policy.leaveBeforeBooking";
export const CANCEL_POLICY_COPY_KEY = "matches.policy.cancelBeforeBooking";

export function capacityForFormat(format: "singles" | "doubles"): number {
  return format === "singles" ? 2 : 4;
}

export function canShowJoinAction(input: {
  viewerStatus?: string | null;
  matchStatus: string;
  requiresCreatorApproval: boolean;
}): "join" | "request" | "none" {
  if (input.viewerStatus) return "none";
  if (input.matchStatus !== "open") return "none";
  return input.requiresCreatorApproval ? "request" : "join";
}

/** Statuses in which a fixed match's time can still be moved. */
const RESCHEDULABLE_STATUSES = ["draft", "open", "full", "ready_to_book"];

export function isFixedTimingMode(timingMode?: string | null): boolean {
  // Matches created before the timing model shipped carry 'flexible'
  // explicitly, so an unknown value is treated as fixed like a new match.
  return timingMode !== "flexible";
}

export function canVoteOnTimes(input: {
  viewerStatus?: string | null;
  matchStatus: string;
  timingMode?: string | null;
}): boolean {
  if (isFixedTimingMode(input.timingMode)) return false;
  return (
    input.viewerStatus === "accepted" &&
    ["open", "full", "ready_to_book"].includes(input.matchStatus)
  );
}

export function canManageProposedTimes(input: {
  viewerIsCreator: boolean;
  matchStatus: string;
  timingMode?: string | null;
}): boolean {
  if (isFixedTimingMode(input.timingMode)) return false;
  return (
    input.viewerIsCreator &&
    ["open", "full", "ready_to_book"].includes(input.matchStatus)
  );
}

/**
 * The host can move a fixed match until a court is secured; after that the hour
 * is committed at the club and the booking must be withdrawn first.
 *
 * Court-first is why the booking is checked directly rather than inferred from
 * the status: a match can now hold an accepted court while still `open`, so the
 * status alone no longer proves the hour is free to move.
 */
export function canRescheduleMatch(input: {
  viewerIsCreator: boolean;
  matchStatus: string;
  timingMode?: string | null;
  hasAcceptedBooking?: boolean;
}): boolean {
  if (input.hasAcceptedBooking) return false;
  return (
    input.viewerIsCreator &&
    isFixedTimingMode(input.timingMode) &&
    RESCHEDULABLE_STATUSES.includes(input.matchStatus)
  );
}

/**
 * The match had its people and its hour, the court was sorted out somewhere
 * else, and nobody recorded it. Left alone it expires silently, so the app
 * asks before that happens.
 *
 * `hasUpcomingTime` is how a passed hour is detected without a new field:
 * `get_match_hub` and `list_my_matches` both drop slots that have already
 * ended, so a `ready_to_book` match with none left is one whose time has gone.
 */
export function canReportMatchPlayed(input: {
  viewerIsParticipant: boolean;
  matchStatus: string;
  hasAcceptedBooking: boolean;
  hasUpcomingTime: boolean;
}): boolean {
  if (!input.viewerIsParticipant) return false;
  if (input.hasAcceptedBooking) return false;
  if (input.hasUpcomingTime) return false;
  return (
    input.matchStatus === "ready_to_book" ||
    input.matchStatus === "booking_pending"
  );
}

export function hasUnanimousTimeYes(input: {
  yesCount: number;
  requiredCount: number;
  participantCount: number;
  capacity: number;
}): boolean {
  return (
    input.participantCount >= input.capacity &&
    input.requiredCount > 0 &&
    input.yesCount === input.requiredCount
  );
}

export const ACTIVE_HOSTED_MATCH_STATUSES = [
  "draft",
  "open",
  "full",
  "ready_to_book",
] as const;

export type ActiveHostedMatchStatus =
  (typeof ACTIVE_HOSTED_MATCH_STATUSES)[number];

export type HostedMatchRef = {
  match_id: string;
  format: string;
  status: string;
  is_creator: boolean;
};

export function isActiveHostedMatchStatus(
  status: string,
): status is ActiveHostedMatchStatus {
  return (ACTIVE_HOSTED_MATCH_STATUSES as readonly string[]).includes(status);
}

export function isDraftMatchStatus(status: string): boolean {
  return status === "draft";
}

export function isPublishedMatchStatus(status: string): boolean {
  return (
    status === "open" ||
    status === "full" ||
    status === "ready_to_book" ||
    status === "booking_pending" ||
    status === "confirmed" ||
    status === "in_progress"
  );
}

export function findActiveHostedMatch<T extends HostedMatchRef>(
  matches: T[],
  format: "singles" | "doubles",
): T | undefined {
  return matches.find(
    (match) =>
      match.is_creator &&
      match.format === format &&
      isActiveHostedMatchStatus(match.status),
  );
}

/**
 * How many matches a player may have on the go at once.
 *
 * Mirrors `hosted_match_cap()` in `087`. Three, counting drafts, across both
 * formats and both visibilities -- one number rather than the per-format,
 * per-visibility rule it replaced, because Discover and player profiles now
 * always create rather than sometimes inviting, which makes creating the
 * common action and a count the right shape of limit for it.
 */
export const HOSTED_MATCH_CAP = 3;

/** Matches counted against `HOSTED_MATCH_CAP`: yours, and still in flight. */
export function activeHostedMatches<T extends HostedMatchRef>(
  matches: readonly T[],
): T[] {
  return matches.filter(
    (match) => match.is_creator && isActiveHostedMatchStatus(match.status),
  );
}

/** True when the server would refuse another `create_match_draft`. */
export function hasReachedHostedMatchCap<T extends HostedMatchRef>(
  matches: readonly T[],
): boolean {
  return activeHostedMatches(matches).length >= HOSTED_MATCH_CAP;
}

export function canCreatorCancelBeforeBooking(status: string): boolean {
  return isActiveHostedMatchStatus(status);
}

/**
 * A match of mine that someone else could still be added to.
 *
 * Deliberately does **not** require `is_creator`, despite taking a
 * `HostedMatchRef`. `create_match_invite` authorises any accepted participant,
 * not just the host, and that is the point in doubles: a player who joined and
 * needs a fourth can find one. It was called `isInviteableHostedMatch`, which
 * read as a hosted-only rule and hid that, so a card could invite into another
 * host's match while looking like it was using your own.
 *
 * The safeguard is not here but at the point of choice: the profile sheet names
 * every match and says whose it is, so nobody is added to a match the inviter
 * never saw.
 */
export function isInviteableMatch(
  match: HostedMatchRef & { participant_count: number; capacity: number },
): boolean {
  return (
    isActiveHostedMatchStatus(match.status) &&
    match.participant_count < match.capacity
  );
}

export function isParticipantStatusActive(status: string): boolean {
  return (
    status === "accepted" || status === "requested" || status === "invited"
  );
}

export function toRpcProposedTimes(times: ProposedTimeInput[]) {
  return times.map((slot) => ({
    starts_at: slot.startsAt,
    ends_at: slot.endsAt,
  }));
}
