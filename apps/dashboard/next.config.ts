import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const dashboardDir = __dirname;
const rootEnvPath = path.resolve(dashboardDir, "../../.env");
const localEnvPath = path.resolve(dashboardDir, ".env.local");

// Prefer app-local .env.local (what Next.js loads natively); also load root .env.
if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath });
}
if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath, override: true });
}

const nextConfig: NextConfig = {
  // Required when opening the dev server via 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // The site root sends visitors to the Beirut landing page. Temporary (307),
  // so the root can become a city picker later. The health check is /health.
  async redirects() {
    return [{ source: "/", destination: "/beirut", permanent: false }];
  },
  async rewrites() {
    return [{ source: "/beirut", destination: "/beirut/index.html" }];
  },
  outputFileTracingIncludes: {
    "/legal/[slug]": ["../../docs/legal/**/*"],
    "/beirut/privacy": ["../../docs/legal/BEIRUT_WAITLIST_PRIVACY_DEV.md"],
  },
};

export default nextConfig;
