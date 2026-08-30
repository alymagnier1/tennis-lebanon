# Backup and Restore Drill

Rehearse backups before every production promotion and at least **monthly** during the pilot. Required by `docs/TESTING_SECURITY.md` pre-release gate.

## Hosted Supabase (staging / production)

### What is backed up

- Supabase **Pro** projects include daily backups and point-in-time recovery (PITR) where enabled.
- Confirm in the Supabase dashboard: **Project Settings → Database → Backups**.

### Staging restore drill (recommended quarterly)

1. Note the current staging project ref and migration version (`supabase migration list` against linked project).
2. Create a **new** Supabase project in the same region (`eu-central-1`).
3. Link CLI: `supabase link --project-ref <new-ref>`.
4. Push schema: `supabase db push`.
5. Restore data using one of:
   - Dashboard **Restore to new project** from a backup snapshot, or
   - `pg_dump` / `pg_restore` from a manual export (see below).
6. Point a temporary dashboard/mobile build at the new project; run `docs/PILOT_OPERATIONS.md` workflow **#3** (club queue).
7. Document elapsed time, blockers, and owner in your ops log.
8. Delete the temporary project when finished.

### Manual logical export (fallback)

```bash
# Linked to target project (requires DB password)
supabase db dump --linked -f backup-$(date +%Y%m%d).sql
```

Store exports in encrypted object storage — **never** commit dumps to git. Rotate credentials after handling production dumps.

### Production incident restore

1. Stop writes: enable maintenance mode on dashboard; pause mobile release if needed.
2. Identify recovery point (timestamp before incident).
3. Use Supabase PITR or restore snapshot to a **new** project.
4. Validate RLS with `supabase test db` against the restored instance (clone repo CI job or local link).
5. Update DNS/env vars to the restored project only after sign-off.
6. Post-incident: root cause, backup gap, and DECISIONS entry if process changed.

## Local development drill

Automates a **data-only** round-trip against the local Supabase stack to prove dump/restore mechanics:

```bash
pnpm drill:backup
```

### What the script does

1. Verifies local Supabase is running (`supabase status`).
2. `supabase db reset --yes` — baseline schema + seed.
3. `supabase db dump --local --data-only` → `.tmp/pilot-backup-drill.sql`.
4. `supabase db reset --yes --no-seed` — schema only, empty data tables.
5. Restores data via `psql` (or `docker exec` into `supabase_db_*` if `psql` is not installed) to `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, after clearing migration-seeded rows (`platform_policy_settings`) so the dump can re-insert them.
6. Runs `pnpm db:test` to confirm authorization tests still pass.

The script refuses any `PILOT_DRILL_DATABASE_URL` that is not localhost — this restore includes seed data and must never touch a hosted project.

### Prerequisites

- Docker Desktop running
- `supabase start` (or `pnpm db:reset` once)
- `psql` on PATH, **or** `PILOT_DRILL_PSQL` set to the client binary, **or** a running `supabase_db_*` container (the script falls back to `docker exec`)

### Troubleshooting

| Symptom                       | Action                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| `connection refused` on 54322 | Run `supabase start`                                       |
| `psql` not found              | Not required if the local `supabase_db_*` container is up  |
| Restore FK errors             | Re-run from clean `db reset`; do not partial-restore       |
| `db:test` fails after restore | Compare migration version; re-run drill from latest `main` |
| `db reset` 502 on Windows | Kong often 502s while postgres already finished. The drill continues if postgres is reachable. |
| `db reset` pulls new Docker images | `supabase link` writes staging service versions into `supabase/.temp/`. Local reset then tries to match them. If a pull hangs, the images are already cached after the first successful start — re-run. |

## Record-keeping

After each drill, log a row. Keep the last successful **staging** drill date in `docs/STAGING_CHECKLIST.md` §3.

| Date       | Environment | Method                            | RTO   | RPO | Tester         | Pass / fail |
| ---------- | ----------- | --------------------------------- | ----- | --- | -------------- | ----------- |
| 2026-08-30 | local       | logical dump → `--no-seed` restore | ~2 min | 0   | Cursor session | pass        |
