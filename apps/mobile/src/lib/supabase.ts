import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import { processLock } from "@supabase/supabase-js";
import { createTennisClient } from "@tennis-lebanon/api";
import {
  readDeviceValue,
  removeDeviceValue,
  writeDeviceValue,
} from "./device-storage";
import { env } from "./env";

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return readDeviceValue(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await writeDeviceValue(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await removeDeviceValue(key);
  },
};

export const supabase = createTennisClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
