#!/usr/bin/env node
// Lightweight, Docker-free sanity check for supabase/migrations. Runs in every
// `pnpm db:validate` call and in CI before the heavier `supabase db reset`
// smoke test (see .github/workflows/ci.yml), which actually applies the
// migrations against a local Postgres instance.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const NAME_PATTERN = /^\d{3,}_[a-z0-9_]+\.sql$/;

function fail(message) {
  console.error(`✖ ${message}`);
  process.exitCode = 1;
}

let files;
try {
  files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
} catch (error) {
  fail(`Could not read ${migrationsDir}: ${error.message}`);
  process.exit(1);
}

if (files.length === 0) {
  fail("No migration files found in supabase/migrations.");
  process.exit(1);
}

const seenPrefixes = new Map();

for (const file of files) {
  const path = join(migrationsDir, file);

  if (!NAME_PATTERN.test(file)) {
    fail(
      `${file}: name must match NNN_description.sql (lowercase, numeric prefix).`,
    );
    continue;
  }

  const prefix = file.split("_")[0];
  if (seenPrefixes.has(prefix)) {
    fail(
      `${file}: duplicate numeric prefix also used by ${seenPrefixes.get(prefix)}.`,
    );
  }
  seenPrefixes.set(prefix, file);

  const stats = statSync(path);
  if (stats.size === 0) {
    fail(`${file}: migration file is empty.`);
    continue;
  }

  const contents = readFileSync(path, "utf8");
  if (
    !/enable row level security/i.test(contents) &&
    /create table/i.test(contents)
  ) {
    console.warn(
      `⚠ ${file}: contains CREATE TABLE with no "enable row level security" in the same file. ` +
        `Confirm RLS is enabled in a companion statement per docs/DATABASE.md.`,
    );
  }
}

if (process.exitCode === 1) {
  process.exit(1);
}

console.log(
  `✓ ${files.length} migration file(s) passed naming and basic checks.`,
);
