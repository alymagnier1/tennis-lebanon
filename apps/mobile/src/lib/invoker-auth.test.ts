import { describe, expect, it } from "vitest";
import {
  isInvokerAuthorized,
  isUsableInvokerToken,
} from "../../../../supabase/functions/_shared/invoker-auth";

/**
 * Guards the `process-notifications` Edge Function. Lives here for the same
 * reason as `notification-copy-parity.test.ts`: the mobile app is the one
 * vitest project whose `rootDir` can reach `supabase/functions/_shared`.
 */

const TOKEN =
  "a3f9c2e81b7d4056a3f9c2e81b7d4056a3f9c2e81b7d4056a3f9c2e81b7d4056";

describe("isInvokerAuthorized", () => {
  it("accepts the exact bearer token", () => {
    expect(isInvokerAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(isInvokerAuthorized(null, TOKEN)).toBe(false);
    expect(isInvokerAuthorized("", TOKEN)).toBe(false);
  });

  it("rejects the right token without the Bearer scheme", () => {
    expect(isInvokerAuthorized(TOKEN, TOKEN)).toBe(false);
  });

  it("rejects a token that differs by one character", () => {
    const wrong = `${TOKEN.slice(0, -1)}0`;
    expect(isInvokerAuthorized(`Bearer ${wrong}`, TOKEN)).toBe(false);
  });

  it("rejects everything when the function has no token configured", () => {
    expect(isInvokerAuthorized("Bearer ", undefined)).toBe(false);
    expect(isInvokerAuthorized("Bearer undefined", undefined)).toBe(false);
  });

  it("rejects everything when the configured token is too short to be a secret", () => {
    expect(isInvokerAuthorized("Bearer abc", "abc")).toBe(false);
  });
});

describe("isUsableInvokerToken", () => {
  it("requires at least 32 characters with no surrounding whitespace", () => {
    expect(isUsableInvokerToken(TOKEN)).toBe(true);
    expect(isUsableInvokerToken(undefined)).toBe(false);
    expect(isUsableInvokerToken("short")).toBe(false);
    expect(isUsableInvokerToken(` ${TOKEN}`)).toBe(false);
    expect(isUsableInvokerToken(`${TOKEN}\n`)).toBe(false);
  });
});
