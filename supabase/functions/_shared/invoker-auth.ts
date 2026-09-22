/**
 * Authorizes the pg_cron invoker of `process-notifications`.
 *
 * The invoker used to present the project's service_role key, compared
 * against the runtime's `SUPABASE_SERVICE_ROLE_KEY`. On a project that has the
 * newer `sb_secret_...` keys alongside the legacy JWTs, the runtime value is
 * not necessarily the key an operator copies from the dashboard, and staging
 * answered every run with 401 for weeks. It also meant the most powerful key
 * in the project sat in Vault just to ring a doorbell.
 *
 * The invoker now presents a dedicated random token, held in two places only:
 * Vault (`process_notifications_token`) and the function's
 * `PROCESS_NOTIFICATIONS_TOKEN` secret. Rotating the service key no longer
 * touches it.
 */

/** Below this, a configured token is a mistake rather than a secret. */
export const MIN_INVOKER_TOKEN_LENGTH = 32;

export function isUsableInvokerToken(token: string | undefined): boolean {
  return (
    typeof token === "string" &&
    token.trim() === token &&
    token.length >= MIN_INVOKER_TOKEN_LENGTH
  );
}

/**
 * Constant-time comparison, so response timing does not reveal how much of a
 * guessed token was right. Length differences return early; the length of the
 * token is not the secret.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export function isInvokerAuthorized(
  authorizationHeader: string | null,
  expectedToken: string | undefined,
): boolean {
  if (!authorizationHeader || !isUsableInvokerToken(expectedToken)) {
    return false;
  }
  return timingSafeEqual(authorizationHeader, `Bearer ${expectedToken}`);
}
