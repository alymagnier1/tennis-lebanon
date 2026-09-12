export type EmailAuthFailure =
  "invalid" | "unconfirmed" | "exists" | "weak" | "generic";

/**
 * Supabase's stable error codes. Prose is matched only as a fallback.
 *
 * The message text is English, subject to rewording, and localized on some
 * paths -- matching it means a Supabase release can quietly collapse every
 * branch into "generic" and leave a player reading "something went wrong"
 * where they should read "wrong password". The codes do not move. Same reason
 * `parseAuthUrl` carries `error_code` instead of reading `error_description`.
 */
const FAILURE_BY_CODE: Record<string, EmailAuthFailure> = {
  invalid_credentials: "invalid",
  email_not_confirmed: "unconfirmed",
  user_already_exists: "exists",
  email_exists: "exists",
  weak_password: "weak",
};

/** Maps a Supabase Auth error onto copy the form can show. */
export function emailAuthFailure(
  error: { message?: string; code?: string } | null,
): EmailAuthFailure {
  const byCode = error?.code ? FAILURE_BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  // Older SDK paths, and a few errors that still arrive without a code.
  const message = error?.message ?? "";
  if (/invalid login credentials/i.test(message)) return "invalid";
  if (/email not confirmed/i.test(message)) return "unconfirmed";
  if (
    /already registered|already been registered|user already exists/i.test(
      message,
    )
  ) {
    return "exists";
  }
  if (
    /password/i.test(message) &&
    /least|weak|short|characters/i.test(message)
  ) {
    return "weak";
  }
  return "generic";
}
