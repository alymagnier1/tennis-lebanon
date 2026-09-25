/**
 * The key `process-notifications` uses for its own database calls.
 *
 * The legacy JWT-based `service_role` key cannot be rotated, and staging's
 * leaked on 2026-09-22, so the project is moving to `sb_secret_...` keys and
 * will deactivate the legacy pair. Supabase injects the new keys as
 * `SUPABASE_SECRET_KEYS`, a JSON object keyed by name (`default` for the one
 * created first), next to the legacy `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * The secret key wins whenever it is present. The legacy key is a fallback
 * only for runtimes that do not inject the new variable -- an older local CLI
 * -- and `source` says which one was used, so a deploy can be checked from the
 * function's response rather than assumed.
 */

export type ServiceKey = {
  key: string;
  source: "secret" | "legacy_service_role";
};

export const DEFAULT_SECRET_KEY_NAME = "default";

function parseSecretKeys(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function resolveServiceKey(env: {
  secretKeys: string | undefined;
  legacyServiceRoleKey: string | undefined;
}): ServiceKey | null {
  const secret = parseSecretKeys(env.secretKeys)[DEFAULT_SECRET_KEY_NAME];
  if (typeof secret === "string" && secret.length > 0) {
    return { key: secret, source: "secret" };
  }
  if (env.legacyServiceRoleKey) {
    return { key: env.legacyServiceRoleKey, source: "legacy_service_role" };
  }
  return null;
}
