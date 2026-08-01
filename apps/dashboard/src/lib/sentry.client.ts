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

/**
 * Reports a caught error, no-oping when no DSN is configured so callers never
 * have to know whether reporting is switched on.
 *
 * Only pass diagnostic context here. Digests and error names are fine; booking
 * details, contact information, and tokens are not.
 */
export async function reportClientError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!env.SENTRY_DSN) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
