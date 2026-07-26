import { createTennisClient } from "@tennis-lebanon/api";
import { env } from "./env";

let browserClient: ReturnType<typeof createTennisClient> | null = null;

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error("Browser Supabase client is only available on the client.");
  }

  if (!browserClient) {
    browserClient = createTennisClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
