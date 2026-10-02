/**
 * Beirut prelaunch waitlist payload. Matches the landing page form.
 * A valid result is a row to insert. It is not an account.
 */

export const PRELAUNCH_CONSENT_VERSION = "beirut-prelaunch-v1";
export const PRELAUNCH_COMMUNITY = "beirut";

/** Signup attempts allowed from one hashed address inside the window. */
export const PRELAUNCH_RATE_LIMIT = 8;
export const PRELAUNCH_RATE_WINDOW_MS = 60 * 60 * 1000;

export const PRELAUNCH_LEVELS = [
  "beginner",
  "improving",
  "intermediate",
  "advanced",
  "competitive",
] as const;

export const PRELAUNCH_AVAILABILITY = [
  "wd-am",
  "wd-pm",
  "wd-ev",
  "we-am",
  "we-pm",
  "we-ev",
] as const;

const LEVELS = new Set<string>(PRELAUNCH_LEVELS);
const SLOTS = new Set<string>(PRELAUNCH_AVAILABILITY);
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,80}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type PrelaunchChannel = "whatsapp" | "email";
export type PrelaunchLevel = (typeof PRELAUNCH_LEVELS)[number];
export type PrelaunchSlot = (typeof PRELAUNCH_AVAILABILITY)[number];

export type PrelaunchSignupInsert = {
  firstName: string;
  channel: PrelaunchChannel;
  contact: string;
  level: PrelaunchLevel;
  court: string | null;
  availability: PrelaunchSlot[];
  community: typeof PRELAUNCH_COMMUNITY;
  consentVersion: typeof PRELAUNCH_CONSENT_VERSION;
  idempotencyKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lebanon is assumed unless the number starts with +, 00, or 961.
 * Returns E.164, or '' when the number is not usable.
 */
export function normalizePrelaunchPhone(raw: string): string {
  let value = raw.trim().replace(/[\s()./-]/g, "");
  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }
  if (!value.startsWith("+")) {
    value = `${/^961\d{7,8}$/.test(value) ? "+" : "+961"}${value.replace(/^0/, "")}`;
  }
  if (value.startsWith("+9610")) {
    value = `+961${value.slice(5)}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    return "";
  }
  if (value.startsWith("+961") && !/^\+961\d{7,8}$/.test(value)) {
    return "";
  }
  return value;
}

export function parsePrelaunchSignup(
  body: unknown,
): { ok: true; row: PrelaunchSignupInsert } | { ok: false } {
  if (!isRecord(body)) {
    return { ok: false };
  }

  if (typeof body.firstName !== "string") {
    return { ok: false };
  }
  const firstName = body.firstName.trim();
  if (firstName.length < 1 || firstName.length > 40) {
    return { ok: false };
  }

  if (body.channel !== "whatsapp" && body.channel !== "email") {
    return { ok: false };
  }
  if (typeof body.contact !== "string") {
    return { ok: false };
  }

  const contact =
    body.channel === "whatsapp"
      ? normalizePrelaunchPhone(body.contact)
      : body.contact.trim().toLowerCase();
  if (body.channel === "email" && !EMAIL.test(contact)) {
    return { ok: false };
  }
  if (!contact) {
    return { ok: false };
  }

  if (typeof body.level !== "string" || !LEVELS.has(body.level)) {
    return { ok: false };
  }

  const court = typeof body.court === "string" ? body.court.trim() : "";
  if (court.length > 100) {
    return { ok: false };
  }

  if (!Array.isArray(body.availability) || body.availability.length < 1) {
    return { ok: false };
  }
  const availability: PrelaunchSlot[] = [];
  for (const slot of body.availability) {
    if (typeof slot !== "string" || !SLOTS.has(slot)) {
      return { ok: false };
    }
    if (!availability.includes(slot as PrelaunchSlot)) {
      availability.push(slot as PrelaunchSlot);
    }
  }

  if (body.adultAndContactConsent !== true) {
    return { ok: false };
  }
  if (body.community !== PRELAUNCH_COMMUNITY) {
    return { ok: false };
  }
  if (body.consentVersion !== PRELAUNCH_CONSENT_VERSION) {
    return { ok: false };
  }
  if (
    typeof body.idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY.test(body.idempotencyKey)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    row: {
      firstName,
      channel: body.channel,
      contact,
      level: body.level as PrelaunchLevel,
      court: court || null,
      availability,
      community: PRELAUNCH_COMMUNITY,
      consentVersion: PRELAUNCH_CONSENT_VERSION,
      idempotencyKey: body.idempotencyKey,
    },
  };
}

/**
 * A unique violation on the idempotency key or the contact is a successful
 * replay: the person is already recorded, and the caller must not learn which.
 */
export function isBenignPrelaunchConflict(error: {
  code?: string;
  message?: string;
  details?: string | null;
}): boolean {
  if (error.code !== "23505") {
    return false;
  }
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return (
    text.includes("prelaunch_signups_idempotency_key") ||
    text.includes("prelaunch_signups_community_contact")
  );
}

export function isPrelaunchRateLimited(recentAttempts: number): boolean {
  return recentAttempts >= PRELAUNCH_RATE_LIMIT;
}
