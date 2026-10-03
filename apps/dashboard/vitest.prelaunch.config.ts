import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: [
      "apps/dashboard/src/app/api/prelaunch-signup/route.test.ts",
      "apps/dashboard/src/app/beirut/landing-copy.test.ts",
      "apps/dashboard/src/app/root-redirect.test.ts",
    ],
  },
});
