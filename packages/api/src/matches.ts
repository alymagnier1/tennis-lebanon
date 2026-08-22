import type { CreateMatchInput } from "@tennis-lebanon/domain";
import { toRpcProposedTimes } from "@tennis-lebanon/domain";
import type { MatchHubBooking } from "./bookings";
import type { TennisSupabaseClient } from "./client";
import type { MatchHubResult } from "./results";

function createMatchRpcArgs(input: CreateMatchInput) {
  return {
    p_format: input.format,
    p_visibility: input.visibility,
    p_intent: input.intent,
    p_min_skill: input.minSkill,
    p_max_skill: input.maxSkill,
    p_requires_creator_approval: input.requiresCreatorApproval,
    p_notes: input.notes ?? undefined,
    p_zone_ids: input.zoneIds,
    p_proposed_times: toRpcProposedTimes(input.proposedTimes),
    p_timing_mode: input.timingMode,
    p_preferred_club_ids: input.preferredClubIds,
  };
}

/**
 * A club the host named at creation as an acceptable venue. Shown to joiners
 * before they commit; not a constraint on where the court is finally booked.
 */
export type MatchPreferredClub = {
  club_id: string;
  name: string;
  booking_mode: string;
};

export type SuggestedMatchTime = {
  starts_at: string;
  ends_at: string;
  candidate_count: number;
};

/**
 * Slots where compatible players are already free, ranked by how many.
 * Lets the host pick an informed time instead of guessing.
 */
export async function suggestMatchTimes(
  client: TennisSupabaseClient,
  input: {
    zoneIds?: string[];
    format?: "singles" | "doubles" | null;
    horizonDays?: number;
    slotMinutes?: number;
    limit?: number;
  } = {},
): Promise<SuggestedMatchTime[]> {
  const { data, error } = await client.rpc("suggest_match_times", {
    p_zone_ids:
      input.zoneIds && input.zoneIds.length > 0 ? input.zoneIds : undefined,
    p_format: input.format ?? undefined,
    p_horizon_days: input.horizonDays ?? 14,
    p_slot_minutes: input.slotMinutes ?? 90,
    p_limit: input.limit ?? 3,
  });

  if (error) throw error;
  return (data ?? []) as SuggestedMatchTime[];
}

export async function rescheduleMatchTime(
  client: TennisSupabaseClient,
  matchId: string,
  startsAt: string,
  endsAt: string,
): Promise<string> {
  const { data, error } = await client.rpc("reschedule_match_time", {
    p_match_id: matchId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });

  if (error) throw error;
  return data as string;
}

export type MatchHubTimeOption = {
  id: string;
  starts_at: string;
  ends_at: string;
  yes_count: number;
  required_count: number;
  viewer_vote: string | null;
};

export type MatchHubCard = {
  match_id: string;
  format: string;
  visibility: string;
  status: string;
  intent: string;
  min_skill: string;
  max_skill: string;
  requires_creator_approval: boolean;
  notes: string | null;
  creator_id: string;
  creator_display_name: string;
  /** 'fixed' (host names the time) or 'flexible' (participants vote). */
  timing_mode: string;
  participant_count: number;
  capacity: number;
  selected_time_option_id: string | null;
  /** Selected hour even after it has started (past `proposed_times` filter). */
  agreed_starts_at: string | null;
  agreed_ends_at: string | null;
  zones: unknown;
  preferred_clubs: MatchPreferredClub[];
  proposed_times: MatchHubTimeOption[];
  participants: unknown;
  pending_requests: unknown;
  viewer_status: string | null;
  viewer_is_creator: boolean;
  next_action: string;
  listing_expires_at: string | null;
  is_stale_warning: boolean;
  can_extend_listing: boolean;
  booking: MatchHubBooking | null;
  result: MatchHubResult | null;
  viewer_attendance: string;
};

export type MyMatchRow = {
  match_id: string;
  format: string;
  status: string;
  visibility: string;
  intent: string;
  participant_status: string;
  is_creator: boolean;
  /** Self-reported attendance once the match is in progress. */
  viewer_attendance: string | null;
  participant_count: number;
  capacity: number;
  soonest_time: string | null;
  notes: string | null;
  updated_at: string;
  listing_expires_at: string | null;
  is_stale_warning: boolean;
  can_extend_listing: boolean;
  /** A court is secured. True before the roster fills on a court-first match. */
  has_court: boolean;
  court_starts_at: string | null;
  opponent_names: string | null;
  club_name: string | null;
  /** Host shortlist; present before a court is booked. */
  preferred_clubs: MatchPreferredClub[] | null;
  /** Match areas for the list card. */
  zones: unknown;
  /** Chat messages from others since this viewer last opened the thread. */
  unread_message_count: number;
};

/**
 * A completed match with no score at all is the ordinary casual case now that
 * attendance is what completes a match, so every result-derived field here is
 * nullable.
 */
export type CompletedMatchRow = {
  match_id: string;
  format: string;
  result_status: string | null;
  score: { sets: [number, number][] } | null;
  winner_user_id: string | null;
  viewer_won: boolean | null;
  viewer_side: 1 | 2 | null;
  submitted_by: string | null;
  submitted_by_name: string | null;
  opponent_names: string | null;
  played_at: string | null;
  club_name: string | null;
  completed_at: string;
};

export type MatchInviteInboxRow = {
  invitation_id: string;
  match_id: string;
  format: string;
  match_status: string;
  creator_display_name: string;
  inviter_display_name: string;
  participant_count: number;
  capacity: number;
  soonest_time: string | null;
  expires_at: string;
  created_at: string;
};

export async function createMatchDraft(
  client: TennisSupabaseClient,
  input: CreateMatchInput,
): Promise<string> {
  const { data, error } = await client.rpc(
    "create_match_draft",
    createMatchRpcArgs(input),
  );

  if (error) throw error;
  return data as string;
}

export async function publishMatch(
  client: TennisSupabaseClient,
  matchId: string,
): Promise<void> {
  const { error } = await client.rpc("publish_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
}

export async function createAndPublishMatch(
  client: TennisSupabaseClient,
  input: CreateMatchInput,
): Promise<string> {
  const { data, error } = await client.rpc(
    "create_and_publish_match",
    createMatchRpcArgs(input),
  );

  if (error) throw error;
  return data as string;
}

export async function joinMatch(
  client: TennisSupabaseClient,
  matchId: string,
): Promise<string> {
  const { data, error } = await client.rpc("join_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
  return data as string;
}

export async function respondToJoinRequest(
  client: TennisSupabaseClient,
  matchId: string,
  userId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await client.rpc("respond_to_join_request", {
    p_match_id: matchId,
    p_user_id: userId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function leaveMatch(
  client: TennisSupabaseClient,
  matchId: string,
): Promise<void> {
  const { error } = await client.rpc("leave_match", { p_match_id: matchId });
  if (error) throw error;
}

/**
 * Answers the prompt raised when a match's hour passed with no court recorded.
 * `true` sends it to the attendance and result flow; `false` closes it.
 */
export async function reportMatchPlayed(
  client: TennisSupabaseClient,
  matchId: string,
  played: boolean,
): Promise<void> {
  const { error } = await client.rpc("report_match_played", {
    p_match_id: matchId,
    p_played: played,
  });
  if (error) throw error;
}

export async function cancelMatch(
  client: TennisSupabaseClient,
  matchId: string,
  reason?: string,
): Promise<void> {
  const { error } = await client.rpc("cancel_match", {
    p_match_id: matchId,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

export async function withdrawFromBookedMatch(
  client: TennisSupabaseClient,
  matchId: string,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc("withdraw_from_booked_match", {
    p_match_id: matchId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function getLateCancelWindowHours(
  client: TennisSupabaseClient,
): Promise<number> {
  const { data, error } = await client.rpc("late_cancel_window_hours");
  if (error) throw error;
  return Number(data ?? 24);
}

export async function createMatchInvite(
  client: TennisSupabaseClient,
  matchId: string,
  invitedUserId?: string,
): Promise<string> {
  const { data, error } = await client.rpc("create_match_invite", {
    p_match_id: matchId,
    p_invited_user_id: invitedUserId ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function acceptMatchInvite(
  client: TennisSupabaseClient,
  token: string,
): Promise<string> {
  const { data, error } = await client.rpc("accept_match_invite", {
    p_token: token,
  });
  if (error) throw error;
  return data as string;
}

export async function listMyMatchInvites(
  client: TennisSupabaseClient,
): Promise<MatchInviteInboxRow[]> {
  const { data, error } = await client.rpc("list_my_match_invites");
  if (error) throw error;
  return (data ?? []) as MatchInviteInboxRow[];
}

export async function acceptMatchInvitation(
  client: TennisSupabaseClient,
  invitationId: string,
): Promise<string> {
  const { data, error } = await client.rpc("accept_match_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
  return data as string;
}

export async function declineMatchInvitation(
  client: TennisSupabaseClient,
  invitationId: string,
): Promise<void> {
  const { error } = await client.rpc("decline_match_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}

export async function castMatchTimeVote(
  client: TennisSupabaseClient,
  matchId: string,
  timeOptionId: string,
  vote: "yes" | "no",
): Promise<void> {
  const { error } = await client.rpc("cast_match_time_vote", {
    p_match_id: matchId,
    p_time_option_id: timeOptionId,
    p_vote: vote,
  });
  if (error) throw error;
}

export async function withdrawMatchTimeOption(
  client: TennisSupabaseClient,
  timeOptionId: string,
): Promise<void> {
  const { error } = await client.rpc("withdraw_match_time_option", {
    p_time_option_id: timeOptionId,
  });
  if (error) throw error;
}

export async function addMatchTimeOption(
  client: TennisSupabaseClient,
  matchId: string,
  startsAt: string,
  endsAt: string,
): Promise<string> {
  const { data, error } = await client.rpc("add_match_time_option", {
    p_match_id: matchId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });
  if (error) throw error;
  return data as string;
}

export async function getMatchHub(
  client: TennisSupabaseClient,
  matchId: string,
): Promise<MatchHubCard> {
  const { data, error } = await client.rpc("get_match_hub", {
    p_match_id: matchId,
  });
  if (error) throw error;
  return data as MatchHubCard;
}

export async function listMyMatches(
  client: TennisSupabaseClient,
): Promise<MyMatchRow[]> {
  const { data, error } = await client.rpc("list_my_matches");
  if (error) throw error;
  return (data ?? []) as MyMatchRow[];
}

export async function listMyCompletedMatches(
  client: TennisSupabaseClient,
): Promise<CompletedMatchRow[]> {
  const { data, error } = await client.rpc("list_my_completed_matches");
  if (error) throw error;
  return (data ?? []) as CompletedMatchRow[];
}

export async function extendMatchListing(
  client: TennisSupabaseClient,
  matchId: string,
): Promise<void> {
  const { error } = await client.rpc("extend_match_listing", {
    p_match_id: matchId,
  });
  if (error) throw error;
}
