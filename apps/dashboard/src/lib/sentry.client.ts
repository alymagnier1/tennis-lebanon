import { env } from "./env";

/** Fails safely with no crash reporting when no DSN is configured. */
export async function initClientSentry(): Promise<void> {
  if (!env.SENTRY_DSN) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    sendDefaultPii: false,
  });
}
