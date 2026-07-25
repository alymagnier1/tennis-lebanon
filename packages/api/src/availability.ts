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
