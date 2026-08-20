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
- [ ] Staging smoke: four workflows in `docs/PILOT_OPERATIONS.md` rehearsed
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

## 7b. Notification delivery (hard gate)

Migration `060_process_notifications_invoker.sql` adds the caller that was
missing: `public.invoke_process_notifications()` posts to the Edge Function and
`pg_cron` runs it every five minutes. Before that migration nothing invoked it
at all, so every reminder, club nudge and attendance prompt was written to the
outbox and left there — silently, with no error anywhere.

The job is inert until both Vault secrets exist. Create them **per
environment** (they differ between staging and production), then confirm the
first run:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/process-notifications',
  'process_notifications_url',
  'Edge Function endpoint invoked by tennis_process_notifications'
);
select vault.create_secret(
  '<service-role-key>',
  'process_notifications_token',
  'Service role key used to authenticate the notification sender'
);

-- Non-null request id means it fired; null means the secrets are still missing.
select public.invoke_process_notifications();
select * from net._http_response order by created desc limit 5;
```

- [x] Named invoker for `process-notifications` recorded below, with schedule
      and which secret it authenticates with
- [ ] Both Vault secrets created in the target environment, and
      `select public.invoke_process_notifications();` returned a request id
- [ ] `select * from cron.job where jobname = 'tennis_process_notifications';`
      shows the job active in the target environment
- [ ] Verified on staging that **one push notification physically arrives** on a
      real device, not merely that the function returned 200
- [ ] `select * from public.unreachable_notification_summary();` reviewed after
      a staging rehearsal

| Setting  | Value                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Invoker  | `pg_cron` job `tennis_process_notifications` → `invoke_process_notifications` |
| Schedule | `*/5 * * * *`                                                                 |
| Secret   | Vault: `process_notifications_url`, `process_notifications_token`             |

### The mobile app needs an Expo project id

Push registration calls `Notifications.getExpoPushTokenAsync({ projectId })`.
With no project id the call is never made, so **no device registers a token at
all** and every notification is parked as `no_delivery_channel` — the invoker
above will run correctly and still deliver nothing. `apps/mobile/app.config.ts`
reads it from `EAS_PROJECT_ID`; `eas init` writes it into `app.json` instead.
A build missing it now reports to Sentry once per session rather than failing
silently.

- [ ] `EAS_PROJECT_ID` set for the build (or present in `app.json`)
- [ ] `select count(*) from public.device_push_tokens where is_active;` is
      non-zero on staging after a real device signs in

### Club staff have no push channel

Push registration exists only in the mobile app, so club staff who work in the
web dashboard have **no** `device_push_tokens` rows. The 4-hour booking nudge is
enqueued for them and can never be delivered by push. Those rows are now parked
as `no_delivery_channel` rather than retried and marked failed, so the backlog
is measurable — but the message still does not arrive.

Reaching club staff out of band needs a decision before pilot. The options:

| Option                     | Needs                                               |
| -------------------------- | --------------------------------------------------- |
| Transactional email        | Provider account and API key (none in the repo yet) |
| WhatsApp Business sender   | Meta business verification; matches how clubs work  |
| Dashboard-only, ops-driven | A human pings clubs; only viable at 5–8 clubs       |

- [ ] Channel chosen and recorded in `docs/DECISIONS.md`
- [ ] If ops-driven: named owner and expected response time agreed with clubs

## 8. Promotion sign-off

| Role              | Name | Date | Notes |
| ----------------- | ---- | ---- | ----- |
| Engineering       |      |      |       |
| Product / founder |      |      |       |
| Club operations   |      |      |       |

Do **not** promote if any item in `docs/TESTING_SECURITY.md` pre-release gate fails.
