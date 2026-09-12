export type EmailAuthFailure =
  "invalid" | "unconfirmed" | "exists" | "weak" | "generic";

/** Maps a Supabase Auth error onto copy the form can show. */
export function emailAuthFailure(
  error: { message?: string } | null,
): EmailAuthFailure {
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
