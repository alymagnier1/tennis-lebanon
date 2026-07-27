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
    proposedTimes: z.array(proposedTimeSchema).min(1).max(3),
  })
  .superRefine((value, ctx) => {
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

export function listOnDiscoverFromVisibility(
  visibility: MatchVisibility | undefined,
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

export function canVoteOnTimes(input: {
  viewerStatus?: string | null;
  matchStatus: string;
}): boolean {
  return (
    input.viewerStatus === "accepted" &&
    ["open", "full", "ready_to_book"].includes(input.matchStatus)
  );
}

export function canManageProposedTimes(input: {
  viewerIsCreator: boolean;
  matchStatus: string;
}): boolean {
  return (
    input.viewerIsCreator &&
    ["open", "full", "ready_to_book"].includes(input.matchStatus)
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

export function canCreatorCancelBeforeBooking(status: string): boolean {
  return isActiveHostedMatchStatus(status);
}

export function isInviteableHostedMatch(
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
