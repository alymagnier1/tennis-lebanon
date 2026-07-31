#!/usr/bin/env node
/**
 * Runs automated pilot release gates from docs/TESTING_SECURITY.md.
 * Does not start Docker or run db:test — use `pnpm drill:backup` for DB drill.
 */
import { execSync } from "node:child_process";

const steps = [
  ["pnpm lint", "ESLint"],
  ["pnpm typecheck", "TypeScript"],
  ["pnpm test", "Unit tests"],
  ["pnpm db:validate", "Migration file checks"],
  ["pnpm format:check", "Prettier format check"],
];

let failed = false;

for (const [command, label] of steps) {
  process.stdout.write(`\n▶ ${label}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`✓ ${label}\n`);
  } catch {
    process.stderr.write(`✖ ${label} failed\n`);
    failed = true;
  }
}

if (failed) {
  process.stderr.write(
    "\nPilot gate verification failed. See docs/STAGING_CHECKLIST.md.\n",
  );
  process.exit(1);
}

process.stdout.write(
  "\n✓ Automated pilot gates passed. Next: pnpm db:test and docs/PILOT_OPERATIONS.md workflows.\n",
);
