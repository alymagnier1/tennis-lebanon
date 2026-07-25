/** Fails safely with no crash reporting when no DSN is configured. */
export async function initServerSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? "local",
    sendDefaultPii: false,
  });
}
