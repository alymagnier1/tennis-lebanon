import type { TennisSupabaseClient } from "./client";

export type PrelaunchSignupRow = {
  id: string;
  first_name: string;
  channel: string;
  contact: string;
  level: string;
  court: string | null;
  availability: string[];
  status: string;
  created_at: string;
};

export async function listPrelaunchSignups(
  client: TennisSupabaseClient,
): Promise<PrelaunchSignupRow[]> {
  const { data, error } = await client.rpc("list_prelaunch_signups", {
    p_community: "beirut",
  });
  if (error) {
    throw error;
  }
  return (data ?? []) as PrelaunchSignupRow[];
}
