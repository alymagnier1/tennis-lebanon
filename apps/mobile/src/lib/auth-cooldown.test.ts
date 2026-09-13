import { beforeEach, describe, expect, it } from "vitest";
import {
  canSendAuthEmail,
  recordAuthEmailSent,
  resetAuthEmailCooldownForTests,
} from "./auth-cooldown";

describe("auth email cooldown", () => {
  beforeEach(resetAuthEmailCooldownForTests);

  it("blocks a repeat to the same address for one minute", () => {
    recordAuthEmailSent("player@example.com", 1_000);
    expect(canSendAuthEmail("player@example.com", 60_999)).toBe(false);
    expect(canSendAuthEmail("player@example.com", 61_000)).toBe(true);
  });

  it("does not block a different address", () => {
    recordAuthEmailSent("player@example.com", 1_000);
    expect(canSendAuthEmail("other@example.com", 1_001)).toBe(true);
  });

  it("treats case and surrounding space as the same address", () => {
    recordAuthEmailSent("player@example.com", 1_000);
    expect(canSendAuthEmail("  Player@Example.com ", 1_001)).toBe(false);
  });

  it("allows the first send to any address", () => {
    expect(canSendAuthEmail("player@example.com", 0)).toBe(true);
  });

  it("forgets addresses whose cooldown has expired", () => {
    recordAuthEmailSent("first@example.com", 1_000);
    recordAuthEmailSent("second@example.com", 62_000);
    expect(canSendAuthEmail("first@example.com", 62_001)).toBe(true);
  });
});
