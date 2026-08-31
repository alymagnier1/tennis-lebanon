import { loadClientEnv } from "@tennis-lebanon/config/env";

/**
 * Validated at import time so a missing/invalid variable fails fast on app
 * start instead of surfacing as a confusing runtime error deep in a screen.
 *
 * Expo Metro only inlines `process.env.EXPO_PUBLIC_*` when each key is a
 * static property read. Passing bare `process.env` into `loadClientEnv` (which
 * indexes with dynamic keys) leaves every value undefined in release APKs —
 * the app then throws before React mounts. Same pattern as the dashboard.
 */
export const env = loadClientEnv(
  {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
    EXPO_PUBLIC_AUTH_REDIRECT_URL: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL,
  },
  "EXPO_PUBLIC_",
);
