import type { Database } from "@tennis-lebanon/types";
import type { TennisSupabaseClient } from "./client";

export type AvailabilityWindow =
  Database["public"]["Tables"]["availability_windows"]["Row"];

export type AvailabilityInsert =
  Database["public"]["Tables"]["availability_windows"]["Insert"];

export async function listOwnAvailability(client: TennisSupabaseClient) {
  const { data, error } = await client
    .from("availability_windows")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createAvailabilityWindow(
  client: TennisSupabaseClient,
  input: AvailabilityInsert,
) {
  const { data, error } = await client
    .from("availability_windows")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export type RecurringAvailabilityInput = {
  weekday: number;
  local_start: string;
  local_end: string;
};

/**
 * Replaces the caller's whole recurring weekly grid in one atomic call.
 * One-off windows are left untouched. Mirrors `set_court_weekly_hours`.
 */
export async function setRecurringAvailability(
  client: TennisSupabaseClient,
  windows: RecurringAvailabilityInput[],
): Promise<number> {
  const { data, error } = await client.rpc("set_recurring_availability", {
    p_windows: windows,
  });

  if (error) throw error;
  return data ?? 0;
}

/**
 * "I'm free then" — one tap, no match created.
 *
 * Writes a one-off `availability_windows` row, so the player becomes visible to
 * everyone whose availability overlaps through the discovery machinery that
 * already exists. Idempotent by overlap: tapping twice, or tapping two adjacent
 * blocks, will not produce two openings for one person.
 */
export async function recordAvailabilityPing(
  client: TennisSupabaseClient,
  startsAt: string,
  endsAt: string,
): Promise<string> {
  const { data, error } = await client.rpc("record_availability_ping", {
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });

  if (error) throw error;
  return data as string;
}

export type AvailabilityLiquiditySlot = {
  starts_at: string;
  ends_at: string;
  player_count: number;
};

/**
 * How many other players are free in each upcoming block.
 *
 * The read half of the ping: `recordAvailabilityPing` writes intent, this is what
 * makes it visible to someone deciding when to be free. Counts only — no names,
 * no ids — and only players the caller could actually be shown in Discover.
 *
 * Aggregated in SQL on purpose. `discoverCompatiblePlayers` is paginated, so
 * counting its rows here would undercount any block with more free players than
 * one page holds.
 */
export async function getAvailabilityLiquidity(
  client: TennisSupabaseClient,
  horizonDays = 7,
): Promise<AvailabilityLiquiditySlot[]> {
  const { data, error } = await client.rpc("get_availability_liquidity", {
    p_horizon_days: horizonDays,
  });

  if (error) throw error;
  return data ?? [];
}

export async function deleteAvailabilityWindow(
  client: TennisSupabaseClient,
  windowId: string,
) {
  const { error } = await client
    .from("availability_windows")
    .delete()
    .eq("id", windowId);

  if (error) throw error;
}
