const AUTH_EMAIL_COOLDOWN_MS = 60_000;

/**
 * Client-side mirror of Supabase's minimum gap between two auth emails to the
 * same address. UX only -- the server enforces the real limit and answers
 * `over_email_send_rate_limit`; this just says so before the round trip.
 *
 * Keyed by address, because the server's limit is. A single shared timestamp
 * meant a sign-up for one address blocked a password reset for a different
 * one, and the copy ("the one we already sent still works") was then a lie.
 *
 * Callers must record **after** a send succeeds. Stamping before the request
 * charged the player for attempts that never produced an email: a dropped
 * connection or a rejected password locked them out for a minute at exactly
 * the moment they were trying to fix it.
 */
const sentAt = new Map<string, number>();

function addressKey(email: string): string {
  return email.trim().toLowerCase();
}

export function canSendAuthEmail(email: string, now = Date.now()): boolean {
  const last = sentAt.get(addressKey(email));
  return last === undefined || now - last >= AUTH_EMAIL_COOLDOWN_MS;
}

export function recordAuthEmailSent(email: string, now = Date.now()): void {
  // Expired entries can never block anything, and the app can outlive a lot of
  // typo'd addresses in one session.
  for (const [address, at] of sentAt) {
    if (now - at >= AUTH_EMAIL_COOLDOWN_MS) sentAt.delete(address);
  }
  sentAt.set(addressKey(email), now);
}

export function resetAuthEmailCooldownForTests(): void {
  sentAt.clear();
}
