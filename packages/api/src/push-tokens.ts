import type { PushPlatform } from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";

export async function registerDevicePushToken(
  client: TennisSupabaseClient,
  deviceId: string,
  token: string,
  platform: PushPlatform,
): Promise<string> {
  const { data, error } = await client.rpc("register_device_push_token", {
    p_device_id: deviceId,
    p_token: token,
    p_platform: platform,
  });
  if (error) throw error;
  return data as string;
}

export async function deactivateDevicePushToken(
  client: TennisSupabaseClient,
  deviceId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("deactivate_device_push_token", {
    p_device_id: deviceId,
  });
  if (error) throw error;
  return Boolean(data);
}
