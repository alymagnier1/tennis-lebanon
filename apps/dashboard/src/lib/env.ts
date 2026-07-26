import { loadClientEnv, loadServerEnv } from "@tennis-lebanon/config/env";

/**
 * Client-safe env for the dashboard.
 *
 * Next.js / Turbopack only inlines `process.env.NEXT_PUBLIC_*` when the full
 * key is a static string. Dynamic access like `process.env[\`${prefix}FOO\`]`
 * stays undefined in the browser bundle — so pass each key explicitly here.
 */
export const env = loadClientEnv(
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    NEXT_PUBLIC_AUTH_REDIRECT_URL: process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL,
  },
  "NEXT_PUBLIC_",
);

/**
 * Server-only env. Import exclusively from Server Components, Route
 * Handlers, or Server Actions -- never from a file marked "use client".
 */
export const serverEnv = loadServerEnv(process.env);
