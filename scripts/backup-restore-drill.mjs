#!/usr/bin/env node
/**
 * Local backup/restore rehearsal. See docs/BACKUP_RESTORE.md.
 *
 * Prefers `psql` on PATH (or PILOT_DRILL_PSQL). Falls back to `docker exec`
 * against the running supabase_db_* container — same pattern as
 * scripts/rating-sandbox.mjs — so the drill works on Windows without a
 * PostgreSQL client install.
 */
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const tmpDir = join(root, ".tmp");
const dumpPath = join(tmpDir, "pilot-backup-drill.sql");
const dbUrl =
  process.env.PILOT_DRILL_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const psqlBin = process.env.PILOT_DRILL_PSQL ?? "psql";

if (!/127\.0\.0\.1|localhost/.test(dbUrl)) {
  process.stderr.write(
    "✖ Refusing to run against a non-local database. This drill restores seed data.\n",
  );
  process.exit(1);
}

function run(command, options = {}) {
  process.stdout.write(`\n> ${command}\n`);
  execSync(command, { stdio: "inherit", cwd: root, ...options });
}

function runReset(command) {
  try {
    run(command);
  } catch {
    // Windows Kong often returns 502 while postgres has already finished the reset.
    try {
      probePlayerA();
    } catch {
      throw new Error(`${command} failed and the database is not reachable`);
    }
    process.stdout.write(
      `\n! ${command} exited non-zero but postgres is reachable; continuing.\n`,
    );
  }
}

function tryRun(command) {
  try {
    run(command);
    return true;
  } catch {
    return false;
  }
}

let cachedContainer = null;
function discoverContainer() {
  if (cachedContainer) return cachedContainer;
  const names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
    encoding: "utf8",
  }).split("\n");
  const found = names.find((n) => n.startsWith("supabase_db_"));
  if (!found) {
    process.stderr.write(
      "✖ No running supabase_db_* container. Start with: supabase start\n",
    );
    process.exit(1);
  }
  cachedContainer = found.trim();
  return cachedContainer;
}

function hasLocalPsql() {
  try {
    execFileSync(psqlBin, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function restoreDump() {
  const dump = readFileSync(dumpPath);
  const payload = Buffer.concat([
    Buffer.from(
      `SET session_replication_role = replica;
TRUNCATE
  public.user_blocks,
  public.player_zones,
  public.platform_roles,
  public.platform_policy_settings,
  public.notifications,
  public.match_zones,
  public.match_time_options,
  public.match_participants,
  public.match_activity,
  public.court_operating_hours,
  public.club_private_contacts,
  public.club_memberships,
  public.matches,
  public.courts,
  public.clubs,
  public.zones,
  public.availability_windows,
  public.player_profiles,
  public.profiles
  CASCADE;
DELETE FROM auth.identities;
DELETE FROM auth.users;
DELETE FROM storage.objects;
DELETE FROM storage.buckets;
`,
    ),
    dump,
    Buffer.from("\nSET session_replication_role = origin;\n"),
  ]);
  if (hasLocalPsql()) {
    process.stdout.write(`\n> ${psqlBin} (restore dump)\n`);
    execFileSync(psqlBin, [dbUrl, "-v", "ON_ERROR_STOP=1"], {
      input: payload,
      stdio: ["pipe", "inherit", "inherit"],
      cwd: root,
    });
    return;
  }

  const container = process.env.PILOT_DRILL_DB_CONTAINER ?? discoverContainer();
  process.stdout.write(
    `\n> docker exec -i ${container} psql (restore dump; no local psql)\n`,
  );
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: payload, stdio: ["pipe", "inherit", "inherit"] },
  );
}

function probePlayerA() {
  const query =
    "SELECT count(*) FROM public.profiles WHERE display_name = 'Player A';";
  if (hasLocalPsql()) {
    return execFileSync(psqlBin, [dbUrl, "-tA", "-c", query], {
      encoding: "utf8",
    }).trim();
  }
  const container = process.env.PILOT_DRILL_DB_CONTAINER ?? discoverContainer();
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tA",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  ).trim();
}

process.stdout.write("Pilot backup/restore drill (local)\n");

if (!tryRun("supabase status")) {
  process.stderr.write(
    "\n✖ Local Supabase is not running. Start with: supabase start\n",
  );
  process.exit(1);
}

mkdirSync(tmpDir, { recursive: true });

runReset("supabase db reset --yes");
run(`supabase db dump --local --data-only -f "${dumpPath}"`);

const stats = statSync(dumpPath);
if (stats.size < 100) {
  process.stderr.write("✖ Dump file looks empty.\n");
  process.exit(1);
}

runReset("supabase db reset --yes --no-seed");

try {
  restoreDump();
} catch {
  process.stderr.write(
    `\n✖ Restore failed. Install psql, set PILOT_DRILL_PSQL, or keep the local supabase_db_* container running.\n` +
      `  Manual step: psql "${dbUrl}" -f "${dumpPath}"\n`,
  );
  process.exit(1);
}

const probe = probePlayerA();
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
