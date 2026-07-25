import { Platform } from "react-native";
import { env } from "./env";

/** Platform-appropriate redirect target for Supabase magic-link emails. */
export function getAuthRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  return env.AUTH_REDIRECT_URL;
}
