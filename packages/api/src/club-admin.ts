import type { TennisSupabaseClient } from "./client";

export type PendingClub = {
  club_id: string;
  name: string;
  slug: string;
  zone_id: string;
  zone_slug: string;
  admin_user_id: string | null;
  admin_display_name: string | null;
  court_count: number;
  submitted_at: string;
};

/**
 * Platform-operator queue of clubs awaiting approval. Clubs register
 * themselves but stay invisible to players until reviewed (SEC-001).
 */
export async function listPendingClubs(
  client: TennisSupabaseClient,
  limit = 50,
): Promise<PendingClub[]> {
  const { data, error } = await client.rpc("list_pending_clubs", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as PendingClub[];
}

export async function reviewPilotClub(
  client: TennisSupabaseClient,
  clubId: string,
  approve: boolean,
  reason?: string,
): Promise<void> {
  const { error } = await client.rpc("review_pilot_club", {
    p_club_id: clubId,
    p_approve: approve,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

/**
 * Soft-deletes a club: hides it from every player-facing read (RLS,
 * discovery, booking creation all gate on is_active) without deleting the
 * row, its courts, or its booking history. Platform operators only, and
 * refused while the club has an open booking. Reversible with
 * {@link reactivateClub}.
 */
export async function deactivateClub(
  client: TennisSupabaseClient,
  clubId: string,
  reason?: string,
): Promise<void> {
  const { error } = await client.rpc("deactivate_club", {
    p_club_id: clubId,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

export async function reactivateClub(
  client: TennisSupabaseClient,
  clubId: string,
  reason?: string,
): Promise<void> {
  const { error } = await client.rpc("reactivate_club", {
    p_club_id: clubId,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

export type ActiveZone = {
  zone_id: string;
  slug: string;
  name_i18n: Record<string, string> | null;
  timezone: string;
};

export type CourtHour = {
  hour_id?: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
};

export type AdminCourt = {
  court_id: string;
  name: string;
  surface: string;
  is_indoor: boolean;
  price_minor: number | null;
  currency: string | null;
  slot_minutes: number;
  is_active: boolean;
  hours: CourtHour[];
};

export type CourtBlock = {
  block_id: string;
  court_id: string;
  court_name: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export type ClubAdminDetail = {
  club: {
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
    booking_phone: string | null;
    amenities: string[];
    is_active: boolean;
  };
  courts: AdminCourt[];
  blocks: CourtBlock[];
};

export type RegisterCourtInput = {
  name: string;
  surface?: string;
  is_indoor?: boolean;
  price_minor?: number | null;
  currency?: string;
  slot_minutes?: number;
};

export async function listActiveZones(
  client: TennisSupabaseClient,
): Promise<ActiveZone[]> {
  const { data, error } = await client.rpc("list_active_zones");
  if (error) throw error;
  return (data ?? []) as ActiveZone[];
}

export async function registerPilotClub(
  client: TennisSupabaseClient,
  input: {
    name: string;
    slug: string;
    zoneId: string;
    description?: string;
    addressPublic?: string;
    latitude?: number | null;
    longitude?: number | null;
    amenities?: string[];
    courts: RegisterCourtInput[];
    bookingMode?: "manual_request" | "external_link";
    /** Required when bookingMode is external_link. */
    bookingPhone?: string | null;
    /**
     * Entering a club on its behalf rather than registering your own: skips the
     * approval queue and creates no membership. Platform operators only.
     */
    asOperator?: boolean;
  },
): Promise<string> {
  const { data, error } = await client.rpc("register_pilot_club", {
    p_name: input.name,
    p_slug: input.slug,
    p_zone_id: input.zoneId,
    p_description: input.description,
    p_address_public: input.addressPublic,
    p_latitude: input.latitude ?? undefined,
    p_longitude: input.longitude ?? undefined,
    p_amenities: input.amenities ?? [],
    p_booking_mode: input.bookingMode ?? undefined,
    p_booking_phone: input.bookingPhone ?? undefined,
    p_as_operator: input.asOperator ?? undefined,
    p_courts: input.courts.map((court) => ({
      name: court.name,
      surface: court.surface ?? "hard",
      is_indoor: court.is_indoor ?? false,
      price_minor: court.price_minor ?? null,
      currency: court.currency ?? "USD",
      slot_minutes: court.slot_minutes ?? 90,
    })),
  });
  if (error) throw error;
  return data as string;
}

export async function getClubAdminDetail(
  client: TennisSupabaseClient,
  clubId: string,
): Promise<ClubAdminDetail> {
  const { data, error } = await client.rpc("get_club_admin_detail", {
    p_club_id: clubId,
  });
  if (error) throw error;
  return data as ClubAdminDetail;
}

export async function updateClubProfile(
  client: TennisSupabaseClient,
  clubId: string,
  input: {
    name: string;
    description?: string;
    addressPublic?: string;
    latitude?: number | null;
    longitude?: number | null;
    amenities?: string[];
  },
): Promise<void> {
  const { error } = await client.rpc("update_club_profile", {
    p_club_id: clubId,
    p_name: input.name,
    p_description: input.description,
    p_address_public: input.addressPublic,
    p_latitude: input.latitude ?? undefined,
    p_longitude: input.longitude ?? undefined,
    p_amenities: input.amenities ?? [],
  });
  if (error) throw error;
}

export async function updateClubBookingSettings(
  client: TennisSupabaseClient,
  clubId: string,
  input: {
    bookingMode: "manual_request" | "external_link";
    bookingPhone?: string | null;
  },
): Promise<void> {
  const { error } = await client.rpc("update_club_booking_settings", {
    p_club_id: clubId,
    p_booking_mode: input.bookingMode,
    p_booking_phone: input.bookingPhone ?? undefined,
  });
  if (error) throw error;
}

export async function upsertClubCourt(
  client: TennisSupabaseClient,
  clubId: string,
  input: {
    courtId?: string;
    name: string;
    surface?: string;
    isIndoor?: boolean;
    priceMinor?: number | null;
    currency?: string;
    slotMinutes?: number;
  },
): Promise<string> {
  const { data, error } = await client.rpc("upsert_club_court", {
    p_club_id: clubId,
    p_court_id: input.courtId,
    p_name: input.name,
    p_surface: input.surface ?? "hard",
    p_is_indoor: input.isIndoor ?? false,
    p_price_minor: input.priceMinor ?? undefined,
    p_currency: input.currency ?? "USD",
    p_slot_minutes: input.slotMinutes ?? 90,
  });
  if (error) throw error;
  return data as string;
}

export async function setCourtWeeklyHours(
  client: TennisSupabaseClient,
  courtId: string,
  hours: Array<{ weekday: number; opensAt: string; closesAt: string }>,
): Promise<void> {
  const { error } = await client.rpc("set_court_weekly_hours", {
    p_court_id: courtId,
    p_hours: hours.map((hour) => ({
      weekday: hour.weekday,
      opens_at: hour.opensAt,
      closes_at: hour.closesAt,
    })),
  });
  if (error) throw error;
}

export async function createCourtBlock(
  client: TennisSupabaseClient,
  courtId: string,
  startsAt: string,
  endsAt: string,
  reason?: string,
): Promise<string> {
  const { data, error } = await client.rpc("create_court_block", {
    p_court_id: courtId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_reason: reason,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteCourtBlock(
  client: TennisSupabaseClient,
  blockId: string,
): Promise<void> {
  const { error } = await client.rpc("delete_court_block", {
    p_block_id: blockId,
  });
  if (error) throw error;
}
