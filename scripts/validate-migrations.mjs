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

/**
 * Function names already defined by an earlier migration.
 *
 * `create or replace function` preserves the existing ACL, so only the
 * migration that *introduces* a function has to grant it. Without this,
 * every redefinition — `get_match_hub` has seven — would be flagged.
 */
const definedFunctions = new Set();

/**
 * Every `create [or replace] function public.name(` in a file, with the body
 * that follows it, so each can be inspected for `security definer` and
 * `returns trigger` independently.
 */
function functionBlocks(sql) {
  const header =
    /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi;
  const starts = [];
  let match;
  while ((match = header.exec(sql)) !== null) {
    starts.push({ name: match[1].toLowerCase(), at: match.index });
  }

  return starts.map((start, index) => ({
    name: start.name,
    body: sql.slice(start.at, starts[index + 1]?.at ?? sql.length),
  }));
}

/** Definer, non-trigger functions and the migration that introduced each. */
const definerFunctions = new Map();
/** Function names that any migration revokes or grants. */
const grantedFunctions = new Set();

/**
 * A `security definer` function runs with RLS bypassed, and one left at the
 * default grant is reachable by `anon` through PostgREST — an internal helper
 * published as an unauthorized public endpoint. Eight sat that way until
 * migration 095; see .claude/skills/supabase-conventions/SKILL.md.
 *
 * Collected across the whole set rather than per file, for two reasons:
 * `create or replace` preserves the existing ACL, so only the migration that
 * introduces a function has to grant it; and a grant may legitimately arrive in
 * a later migration, which is how the 095 backfill works without rewriting the
 * applied migrations that introduced the problem.
 *
 * Trigger functions are exempt: they cannot be invoked without OLD and NEW.
 */
function collectDefinerGrants(file, contents) {
  for (const block of functionBlocks(contents)) {
    const isNew = !definedFunctions.has(block.name);
    definedFunctions.add(block.name);

    if (!isNew) continue;
    if (!/security\s+definer/i.test(block.body)) continue;
    if (/returns\s+trigger/i.test(block.body)) continue;

    definerFunctions.set(block.name, file);
  }

  const grants =
    /(?:revoke|grant)[\s\S]{0,200}?function\s+public\.([a-z0-9_]+)\s*\(/gi;
  let match;
  while ((match = grants.exec(contents)) !== null) {
    grantedFunctions.add(match[1].toLowerCase());
  }
}

for (const file of files.slice().sort()) {
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

  collectDefinerGrants(file, contents);
}

for (const [name, file] of definerFunctions) {
  if (grantedFunctions.has(name)) continue;

  fail(
    [
      `${file}: public.${name} is a "security definer" function that no migration`,
      `  revokes or grants. At the default grant it is callable by anon through`,
      `  PostgREST with RLS bypassed. Add one of:`,
      `    revoke all on function public.${name}(...) from public, anon;`,
      `    grant execute on function public.${name}(...) to authenticated;`,
      `  ...for a caller-facing RPC, or revoke from "public, anon, authenticated"`,
      `  for an internal helper. Never edit an applied migration — add a new one,`,
      `  as 095 did. See .claude/skills/supabase-conventions/SKILL.md.`,
    ].join("\n"),
  );
}

if (process.exitCode === 1) {
  process.exit(1);
}

console.log(
  `✓ ${files.length} migration file(s) passed naming and basic checks.`,
);
