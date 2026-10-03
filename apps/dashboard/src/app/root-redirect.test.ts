import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("site root", () => {
  it("sends visitors to the Beirut landing page with a temporary redirect", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toContainEqual({
      source: "/",
      destination: "/beirut",
      permanent: false,
    });
  });

  it("serves the health check at /health, not at the root", () => {
    expect(existsSync(path.join(__dirname, "health", "page.tsx"))).toBe(true);
    expect(existsSync(path.join(__dirname, "page.tsx"))).toBe(false);
  });
});
