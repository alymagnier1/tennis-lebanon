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

/**
 * Reports a caught error, no-oping when no DSN is configured so callers never
 * have to know whether reporting is switched on.
 *
 * Only pass diagnostic context here. Component stacks and error names are
 * fine; message bodies, contact details, and tokens are not.
 */
export async function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!env.SENTRY_DSN) {
    return;
  }

  const Sentry = await import("@sentry/react-native");
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
