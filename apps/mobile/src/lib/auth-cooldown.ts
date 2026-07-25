const MAGIC_LINK_COOLDOWN_MS = 60_000;
let lastRequestAt = 0;

export function canRequestMagicLink(now = Date.now()): boolean {
  return now - lastRequestAt >= MAGIC_LINK_COOLDOWN_MS;
}

export function recordMagicLinkRequest(now = Date.now()): void {
  lastRequestAt = now;
}

export function resetMagicLinkCooldownForTests(): void {
  lastRequestAt = 0;
}
