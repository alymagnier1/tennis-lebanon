import { useState } from "react";
import { router } from "expo-router";
import { env } from "../lib/env";
import { nativeGoogleIdToken } from "../lib/google-native";
import {
  completeGoogleSignIn,
  isGoogleSignInConfigured,
  type GoogleSignInFailure,
} from "../lib/google-sign-in";
import { supabase } from "../lib/supabase";

export function useGoogleAuthButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    reason: GoogleSignInFailure;
    detail?: string;
  } | null>(null);
  const available = isGoogleSignInConfigured(env.GOOGLE_WEB_CLIENT_ID);

  const signIn = async () => {
    setError(null);
    setBusy(true);
    const result = await completeGoogleSignIn(supabase, nativeGoogleIdToken);
    setBusy(false);

    if (result.ok) {
      router.replace("/");
      return;
    }
    if (result.reason === "cancelled") return;
    setError({ reason: result.reason, detail: result.detail });
  };

  return { available, busy, error, signIn };
}
