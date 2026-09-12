export const CHECK_EMAIL_REASONS = ["confirm", "reset"] as const;

export type CheckEmailReason = (typeof CHECK_EMAIL_REASONS)[number];

export function parseCheckEmailReason(value: unknown): CheckEmailReason {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "reset" ? "reset" : "confirm";
}
