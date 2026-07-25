import { env } from "./env";

/** Fails safely with no crash reporting when no DSN is configured. */
export async function initSentry(): Promise<void> {
  if (!env.SENTRY_DSN) {
    return;
  }

  const Sentry = await import("@sentry/react-native");
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
  });
}
