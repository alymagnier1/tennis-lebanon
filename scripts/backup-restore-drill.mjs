#!/usr/bin/env node
/**
 * Local backup/restore rehearsal. See docs/BACKUP_RESTORE.md.
 */
import { execSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const tmpDir = join(root, ".tmp");
const dumpPath = join(tmpDir, "pilot-backup-drill.sql");
const dbUrl =
  process.env.PILOT_DRILL_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const psql = process.env.PILOT_DRILL_PSQL ?? "psql";

function run(command, options = {}) {
  process.stdout.write(`\n> ${command}\n`);
  execSync(command, { stdio: "inherit", cwd: root, ...options });
}

function tryRun(command) {
  try {
    run(command);
    return true;
  } catch {
    return false;
  }
}

process.stdout.write("Pilot backup/restore drill (local)\n");

if (!tryRun("supabase status")) {
  process.stderr.write(
    "\n✖ Local Supabase is not running. Start with: supabase start\n",
  );
  process.exit(1);
}

mkdirSync(tmpDir, { recursive: true });

run("supabase db reset");
run(`supabase db dump --local --data-only -f "${dumpPath}"`);

const stats = statSync(dumpPath);
if (stats.size < 100) {
  process.stderr.write("✖ Dump file looks empty.\n");
  process.exit(1);
}

run("supabase db reset");

const restoreCommand =
  process.platform === "win32"
    ? `cmd /c type "${dumpPath}" | "${psql}" "${dbUrl}"`
    : `"${psql}" "${dbUrl}" -f "${dumpPath}"`;

if (!tryRun(restoreCommand)) {
  process.stderr.write(
    `\n✖ Restore failed. Install psql or set PILOT_DRILL_PSQL to the client binary.\n` +
      `  Manual step: psql "${dbUrl}" -f "${dumpPath}"\n`,
  );
  process.exit(1);
}

// Spot-check seeded identity survived restore
const probe = execSync(
  `"${psql}" "${dbUrl}" -t -c "SELECT count(*) FROM public.profiles WHERE display_name = 'Player A';"`,
  { encoding: "utf8" },
).trim();

if (probe !== "1") {
  process.stderr.write(
    `✖ Post-restore probe failed (expected 1 Player A profile, got ${probe}).\n`,
  );
  process.exit(1);
}

run("pnpm db:test");

process.stdout.write(
  `\n✓ Backup/restore drill passed.\n` +
    `  Dump: ${dumpPath} (${stats.size} bytes)\n` +
    `  Record this run in docs/BACKUP_RESTORE.md log.\n`,
);
