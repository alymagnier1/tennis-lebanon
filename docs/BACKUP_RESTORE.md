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
2. `supabase db reset` — baseline schema + seed.
3. `supabase db dump --local --data-only` → `.tmp/pilot-backup-drill.sql`.
4. `supabase db reset` again — schema only, empty data tables.
5. Restores data via `psql` to `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
6. Runs `pnpm db:test` to confirm authorization tests still pass.

### Prerequisites

- Docker Desktop running
- `supabase start` (or `pnpm db:reset` once)
- `psql` on PATH (PostgreSQL client tools), **or** set `PILOT_DRILL_PSQL` to the full path

### Troubleshooting

| Symptom                       | Action                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| `connection refused` on 54322 | Run `supabase start`                                       |
| `psql` not found              | Install PostgreSQL client or set `PILOT_DRILL_PSQL`        |
| Restore FK errors             | Re-run from clean `db reset`; do not partial-restore       |
| `db:test` fails after restore | Compare migration version; re-run drill from latest `main` |

## Record-keeping

After each drill, log:

| Field                  | Value                          |
| ---------------------- | ------------------------------ |
| Date                   |                                |
| Environment            | local / staging / production   |
| Method                 | PITR / snapshot / logical dump |
| Recovery time (RTO)    |                                |
| Data loss window (RPO) |                                |
| Tester                 |                                |
| Pass / fail            |                                |

Keep the last successful staging drill date in your promotion checklist (`docs/STAGING_CHECKLIST.md` §3).
