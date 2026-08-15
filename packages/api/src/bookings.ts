import type { TennisSupabaseClient } from "./client";

export type ClubDirectoryRow = {
  club_id: string;
  name: string;
  slug: string;
  description: string | null;
  address_public: string | null;
  zone_id: string;
  zone_slug: string;
  zone_name_i18n: Record<string, string> | null;
  latitude: number | null;
  longitude: number | null;
  booking_mode: string;
  amenities: string[];
  court_count: number;
  min_price_minor: number | null;
  currency: string | null;
  is_favorite: boolean;
};

export type ClubCourt = {
  court_id: string;
  name: string;
  surface: string;
  is_indoor: boolean;
  price_minor: number | null;
  currency: string | null;
  slot_minutes: number;
};

export type ClubDetail = {
  club_id: string;
  name: string;
  slug: string;
  description: string | null;
  address_public: string | null;
  zone_id: string;
  zone_slug: string;
  zone_name_i18n: Record<string, string> | null;
  latitude: number | null;
  longitude: number | null;
  booking_mode: string;
  whatsapp_booking_available: boolean;
  amenities: string[];
  is_favorite: boolean;
  courts: ClubCourt[];
};

export type MatchHubBooking = {
  booking_id: string;
  status: string;
  court_id: string;
  court_name: string;
  club_id: string;
  club_name: string;
  starts_at: string;
  ends_at: string;
  price_minor: number | null;
  currency: string | null;
  payment_method: string;
  club_note: string | null;
  proposed_court_id: string | null;
  proposed_court_name: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
};

export async function listClubsDirectory(
  client: TennisSupabaseClient,
  zoneIds?: string[],
): Promise<ClubDirectoryRow[]> {
  const { data, error } = await client.rpc("list_clubs_directory", {
    p_zone_ids: zoneIds?.length ? zoneIds : undefined,
  });
  if (error) throw error;
  return (data ?? []) as ClubDirectoryRow[];
}

export async function getClubDetail(
  client: TennisSupabaseClient,
  clubId: string,
): Promise<ClubDetail> {
  const { data, error } = await client.rpc("get_club_detail", {
    p_club_id: clubId,
  });
  if (error) throw error;
  return data as ClubDetail;
}

export async function setClubFavorite(
  client: TennisSupabaseClient,
  clubId: string,
  favorite: boolean,
): Promise<void> {
  const { error } = await client.rpc("set_club_favorite", {
    p_club_id: clubId,
    p_favorite: favorite,
  });
  if (error) throw error;
}

export type ClubWhatsAppBookingLink = {
  club_id: string;
  club_name: string;
  phone_digits: string;
  message: string;
};

export async function getClubWhatsAppBookingLink(
  client: TennisSupabaseClient,
  clubId: string,
  matchId?: string,
): Promise<ClubWhatsAppBookingLink> {
  const { data, error } = await client.rpc("get_club_whatsapp_booking_link", {
    p_club_id: clubId,
    p_match_id: matchId,
  });
  if (error) throw error;
  return data as ClubWhatsAppBookingLink;
}

export async function requestMatchBooking(
  client: TennisSupabaseClient,
  matchId: string,
  courtId: string,
): Promise<string> {
  const { data, error } = await client.rpc("request_match_booking", {
    p_match_id: matchId,
    p_court_id: courtId,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Records a court the host secured directly with the club, for example over
 * WhatsApp. Without this, clubs in external_link mode can never leave
 * ready_to_book and the match is never counted as played.
 */
export async function confirmExternalCourt(
  client: TennisSupabaseClient,
  input: {
    matchId: string;
    courtId: string;
    startsAt: string;
    endsAt: string;
    note?: string | null;
  },
): Promise<string> {
  const { data, error } = await client.rpc("confirm_external_court", {
    p_match_id: input.matchId,
    p_court_id: input.courtId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_note: input.note ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Undoes a court the host recorded himself. Refuses a booking the club accepted
 * through its own queue -- that lifecycle belongs to accept/reject.
 */
export async function releaseExternalCourt(
  client: TennisSupabaseClient,
  matchId: string,
  reason?: string | null,
): Promise<void> {
  const { error } = await client.rpc("release_external_court", {
    p_match_id: matchId,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

export async function cancelBookingRequest(
  client: TennisSupabaseClient,
  bookingId: string,
): Promise<void> {
  const { error } = await client.rpc("cancel_booking_request", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
}

export async function respondBookingAlternative(
  client: TennisSupabaseClient,
  bookingId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await client.rpc("respond_booking_alternative", {
    p_booking_id: bookingId,
    p_accept: accept,
  });
  if (error) throw error;
}

export type StaffClub = {
  club_id: string;
  name: string;
  slug: string;
  role: string;
  /** False while the club is awaiting platform approval (SEC-001). */
  is_active: boolean;
};

export type ClubBookingQueueRow = {
  booking_id: string;
  match_id: string;
  status: string;
  court_id: string;
  court_name: string;
  starts_at: string;
  ends_at: string;
  requested_by: string;
  requester_name: string;
  match_format: string;
  participant_count: number;
  created_at: string;
};

export type ClubBookingDetailCourt = {
  court_id: string;
  name: string;
  surface: string;
  is_indoor: boolean;
  price_minor: number | null;
  currency: string | null;
  slot_minutes: number;
};

export type ClubBookingDetail = {
  booking: {
    booking_id: string;
    status: string;
    court_id: string;
    court_name: string;
    starts_at: string;
    ends_at: string;
    price_minor: number | null;
    currency: string | null;
    payment_method: string;
    club_note: string | null;
    proposed_court_id: string | null;
    proposed_court_name: string | null;
    proposed_start_at: string | null;
    proposed_end_at: string | null;
    created_at: string;
    acted_at: string | null;
  };
  match: {
    match_id: string;
    format: string;
    status: string;
    play_intent: string;
  };
  requester: {
    user_id: string;
    display_name: string;
  };
  club: {
    club_id: string;
    name: string;
  };
  participants: Array<{
    user_id: string;
    display_name: string;
    is_creator: boolean;
  }>;
  courts: ClubBookingDetailCourt[];
};

export async function listStaffClubs(
  client: TennisSupabaseClient,
): Promise<StaffClub[]> {
  const { data, error } = await client.rpc("list_staff_clubs");
  if (error) throw error;
  return (data ?? []) as StaffClub[];
}

export async function listClubBookingRequests(
  client: TennisSupabaseClient,
  clubId: string,
  options?: {
    statuses?: Array<
      | "requested"
      | "alternative_proposed"
      | "accepted"
      | "rejected"
      | "cancelled"
      | "completed"
    >;
    search?: string;
  },
): Promise<ClubBookingQueueRow[]> {
  const { data, error } = await client.rpc("list_club_booking_requests", {
    p_club_id: clubId,
    p_statuses: options?.statuses,
    p_search: options?.search,
  });
  if (error) throw error;
  return (data ?? []) as ClubBookingQueueRow[];
}

export async function getClubBookingDetail(
  client: TennisSupabaseClient,
  bookingId: string,
): Promise<ClubBookingDetail> {
  const { data, error } = await client.rpc("get_club_booking_detail", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data as ClubBookingDetail;
}

export async function acceptBooking(
  client: TennisSupabaseClient,
  bookingId: string,
): Promise<void> {
  const { error } = await client.rpc("accept_booking", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
}

export async function rejectBooking(
  client: TennisSupabaseClient,
  bookingId: string,
  reason?: string,
): Promise<void> {
  const { error } = await client.rpc("reject_booking", {
    p_booking_id: bookingId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function proposeBookingAlternative(
  client: TennisSupabaseClient,
  bookingId: string,
  courtId: string,
  startsAt: string,
  endsAt: string,
  reason?: string,
): Promise<void> {
  const { error } = await client.rpc("propose_booking_alternative", {
    p_booking_id: bookingId,
    p_court_id: courtId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_reason: reason,
  });
  if (error) throw error;
}
