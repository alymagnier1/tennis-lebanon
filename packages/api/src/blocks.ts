import type { TennisSupabaseClient } from "./client";

export async function blockUser(
  client: TennisSupabaseClient,
  blockedUserId: string,
) {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) {
    throw new Error("Authentication required");
  }

  const { error } = await client.from("user_blocks").insert({
    blocker_id: user.id,
    blocked_id: blockedUserId,
  });

  if (error) throw error;
}

export async function unblockUser(
  client: TennisSupabaseClient,
  blockedUserId: string,
) {
  const { error } = await client
    .from("user_blocks")
    .delete()
    .eq("blocked_id", blockedUserId);

  if (error) throw error;
}
