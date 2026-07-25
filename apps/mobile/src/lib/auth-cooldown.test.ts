import { beforeEach, describe, expect, it } from "vitest";
import {
  canRequestMagicLink,
  recordMagicLinkRequest,
  resetMagicLinkCooldownForTests,
} from "./auth-cooldown";

describe("magic-link cooldown", () => {
  beforeEach(resetMagicLinkCooldownForTests);

  it("blocks repeated requests for one minute", () => {
    recordMagicLinkRequest(1_000);
    expect(canRequestMagicLink(60_999)).toBe(false);
    expect(canRequestMagicLink(61_000)).toBe(true);
  });
});
