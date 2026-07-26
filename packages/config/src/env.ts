import { z } from "zod";

/**
 * Client-safe environment shared by mobile and dashboard. Anything read here
 * must be safe to ship inside a mobile or browser bundle.
 */
const clientSchema = z
  .object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    SENTRY_DSN: z.string().url().optional().or(z.literal("")),
    APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
    SUPPORT_EMAIL: z.string().email().default("support@tennis-lebanon.invalid"),
    AUTH_REDIRECT_URL: z.string().url(),
  })
  .superRefine((value, context) => {
    if (value.APP_ENV !== "local" && value.SUPPORT_EMAIL.endsWith(".invalid")) {
      context.addIssue({
        code: "custom",
        path: ["SUPPORT_EMAIL"],
        message: "A real support email is required outside local development.",
      });
    }
  });

export type ClientEnv = z.infer<typeof clientSchema>;

/**
 * Reads and validates client-safe env vars from a prefixed source
 * (`EXPO_PUBLIC_*` for mobile, `NEXT_PUBLIC_*` for the dashboard).
 *
 * For Next.js / Turbopack, the caller must pass an object with **static**
 * `process.env.NEXT_PUBLIC_*` property reads. Dynamic keys on `process.env`
 * are not inlined into the client bundle and will appear as undefined.
 *
 * Throws with a readable message at startup rather than failing deep inside
 * the app the first time a missing variable is used.
 */
export function loadClientEnv(
  source: Record<string, string | undefined>,
  prefix: "EXPO_PUBLIC_" | "NEXT_PUBLIC_",
): ClientEnv {
  const result = clientSchema.safeParse({
    SUPABASE_URL: source[`${prefix}SUPABASE_URL`],
    SUPABASE_ANON_KEY: source[`${prefix}SUPABASE_ANON_KEY`],
    SENTRY_DSN: source[`${prefix}SENTRY_DSN`] ?? "",
    APP_ENV: source[`${prefix}APP_ENV`],
    SUPPORT_EMAIL: source[`${prefix}SUPPORT_EMAIL`],
    AUTH_REDIRECT_URL:
      source[`${prefix}AUTH_REDIRECT_URL`] ??
      (prefix === "EXPO_PUBLIC_"
        ? "tennislebanon://auth/callback"
        : "http://127.0.0.1:3000/auth/callback"),
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid environment configuration (${prefix}*): ${issues}. Check .env against .env.example.`,
    );
  }

  return result.data;
}

/**
 * Server-only environment for the dashboard's server components/route
 * handlers. Never import this from client components or the mobile app.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function loadServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const result = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY:
      source.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment configuration: ${issues}.`);
  }

  return result.data;
}
