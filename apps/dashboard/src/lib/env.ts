import { loadClientEnv, loadServerEnv } from "@tennis-lebanon/config/env";

/** Client-safe env, readable from Client Components. */
export const env = loadClientEnv(process.env, "NEXT_PUBLIC_");

/**
 * Server-only env. Import exclusively from Server Components, Route
 * Handlers, or Server Actions -- never from a file marked "use client".
 */
export const serverEnv = loadServerEnv(process.env);
