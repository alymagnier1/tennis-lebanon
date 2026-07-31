# Staging to Production Checklist

Use this checklist before promoting a build to production or opening the pilot to real clubs. Pair with `docs/BACKUP_RESTORE.md`, `docs/PILOT_OPERATIONS.md`, and `docs/TESTING_SECURITY.md`.

## 1. Code and CI gates

Run locally (or confirm CI green on the release commit):

```bash
pnpm verify:pilot          # format, lint, typecheck, unit tests, migration checks
pnpm db:reset              # requires Docker + Supabase CLI
pnpm db:test               # RLS / RPC authorization matrix
```

- [ ] `pnpm verify:pilot` passes
- [ ] `pnpm db:test` passes on the release commit
- [ ] No open critical/high security findings
- [ ] Database types regenerated if migrations changed: `pnpm db:types`

## 2. Environment separation

| Variable         | Staging                     | Production                               |
| ---------------- | --------------------------- | ---------------------------------------- |
| `APP_ENV`        | `staging`                   | `production`                             |
| Supabase project | Dedicated staging project   | Dedicated production project             |
| `SUPPORT_EMAIL`  | Real monitored inbox        | Real monitored inbox (not `*.invalid`)   |
| Sentry DSN       | Staging project             | Production project                       |
| PostHog          | Disabled or staging project | Enabled only after consent copy approved |

- [ ] Staging and production use **separate** Supabase projects (Frankfurt `eu-central-1` per `docs/ARCHITECTURE.md`)
- [ ] No service-role key in mobile or browser bundles
- [ ] Production env vars set in host dashboards only (EAS, Vercel) — not committed to git
- [ ] `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` reviewed for accidental secrets

## 3. Database and migrations

- [ ] All migrations applied to staging in order (`supabase db push` or CI deploy)
- [ ] Staging smoke: five workflows in `docs/PILOT_OPERATIONS.md` rehearsed
- [ ] Backup/restore drill completed within last 30 days (`docs/BACKUP_RESTORE.md`)
- [ ] `platform_policy_settings`, lifecycle cron (`process-notifications`), and RLS spot-check documented
- [ ] Seed data **not** copied to production (real clubs onboarded via dashboard)

## 4. Mobile release

- [ ] EAS build profiles (`development`, `preview`, `production`) reviewed
- [ ] App version/build number incremented
- [ ] Deep links and magic-link redirect URLs match staging/production Supabase auth settings
- [ ] Push notification credentials configured for the target environment
- [ ] TestFlight / Play internal track build uploaded ≥1–2 weeks before pilot start
- [ ] Arabic + English smoke on physical devices (Settings → RTL layout check)

## 5. Dashboard release

- [ ] Vercel preview URL smoke-tested with club-staff flows
- [ ] Production domain and HTTPS configured
- [ ] Platform admin routes (`/admin/reports`, `/admin/disputes`) restricted to operators
- [ ] Login form and booking queue tested on Chrome + Safari

## 6. Legal and support

- [ ] `docs/legal/*` reviewed by founder/legal counsel — dev drafts are **not** production-ready
- [ ] Production privacy policy, terms, and community rules published at stable URLs
- [ ] Account deletion and support contact documented in-app and in store listings
- [ ] Club data-processing terms signed with partner clubs (out of band)

## 7. Observability and incident response

- [ ] Sentry receiving events from staging build (scrub PII per `docs/TESTING_SECURITY.md`)
- [ ] On-call / ops owner named for booking disputes and moderation queue
- [ ] Rollback plan documented: previous mobile build + dashboard promotion + migration revert policy

## 8. Promotion sign-off

| Role              | Name | Date | Notes |
| ----------------- | ---- | ---- | ----- |
| Engineering       |      |      |       |
| Product / founder |      |      |       |
| Club operations   |      |      |       |

Do **not** promote if any item in `docs/TESTING_SECURITY.md` pre-release gate fails.
