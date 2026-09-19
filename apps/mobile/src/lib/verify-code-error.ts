export type VerifyCodeFailure = "invalid" | "rateLimited" | "generic";
export type ResendCodeFailure = "rateLimited" | "generic";

/**
 * Supabase's stable error codes, matched the way `emailAuthFailure` does, and
 * for the same reason: the prose is English, reworded between releases, and
 * localized on some paths, so matching it collapses real causes into
 * "something went wrong".
 *
 * `otp_expired` covers a wrong code **and** an expired one. That is not a gap
 * in this mapping -- Supabase deliberately answers both with one error so a
 * caller cannot use the difference to probe which codes exist. The copy has to
 * name both possibilities because the server genuinely does not say which.
 */
const VERIFY_FAILURE_BY_CODE: Record<string, VerifyCodeFailure> = {
  otp_expired: "invalid",
  validation_failed: "invalid",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "rateLimited",
};

const RESEND_FAILURE_BY_CODE: Record<string, ResendCodeFailure> = {
  over_email_send_rate_limit: "rateLimited",
  over_request_rate_limit: "rateLimited",
};

/** supabase-js rejects with a plain object, not an `Error`. */
function readError(error: unknown): { code?: string; message: string } {
  if (!error || typeof error !== "object") return { message: "" };
  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : "",
  };
}

/** Copy key suffix for a failed `verifyOtp`. */
export function verifyCodeFailure(error: unknown): VerifyCodeFailure {
  const { code, message } = readError(error);
  const byCode = code ? VERIFY_FAILURE_BY_CODE[code] : undefined;
  if (byCode) return byCode;

  if (/rate limit|too many/i.test(message)) return "rateLimited";
  if (/expired|invalid|incorrect/i.test(message)) return "invalid";
  return "generic";
}

/** Copy key suffix for a failed `resend`. */
export function resendCodeFailure(error: unknown): ResendCodeFailure {
  const { code, message } = readError(error);
  const byCode = code ? RESEND_FAILURE_BY_CODE[code] : undefined;
  if (byCode) return byCode;

  return /rate limit|too many|security purposes/i.test(message)
    ? "rateLimited"
    : "generic";
}
