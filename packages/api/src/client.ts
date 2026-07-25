import {
  createClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "@tennis-lebanon/types";

export type TennisSupabaseClient = ReturnType<typeof createTennisClient>;

export function createTennisClient(
  url: string,
  publishableKey: string,
  options?: SupabaseClientOptions<"public">,
) {
  return createClient<Database>(url, publishableKey, options);
}
