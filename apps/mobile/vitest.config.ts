import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    /*
     * Serial by default, because the gate has to be trustworthy.
     *
     * `confirm-*`, `navigation` and `invite-link` drive promises that settle from
     * a mocked callback, and under parallel load on a machine also running the
     * Expo bundler and Docker they take 9-10s and blow the 5s timeout. Everyone
     * already worked around it by passing `--no-file-parallelism` by hand, which
     * meant `pnpm test` -- and therefore `pnpm verify:pilot`, Phase 0.1 of the
     * launch checklist -- failed for anyone who did not know the incantation.
     *
     * This is a workaround, not a diagnosis: those tests are slow under
     * contention rather than wrong. Raising `testTimeout` instead would keep the
     * parallel speed, at the cost of letting a genuine hang sit for 20s before
     * anyone noticed.
     */
    fileParallelism: false,
  },
});
