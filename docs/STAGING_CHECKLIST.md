# Staging to Production Checklist

Use this checklist before promoting a build to production or opening the pilot to real clubs. Pair with `docs/BACKUP_RESTORE.md`, `docs/PILOT_OPERATIONS.md`, and `docs/TESTING_SECURITY.md`.

## 1. Code and CI gates

Run locally (or confirm CI green on the release commit):

```bash
pnpm verify:pilot          # format, lint, typecheck, unit tests, migration checks
pnpm db:reset              # requires Docker + Supabase CLI
pnpm db:test               # RLS / RPC authorization matrix
```

`db:test` is transactional and does not pollute the database, but it does read
it. Run `db:reset` first, or if you are keeping local data you have been using
the app against, clear the three things that accumulate through real use and
make the suite fail for reasons unrelated to the change:

```sql
delete from public.discovery_search_log;                                  -- 30 searches/minute
delete from public.match_invitations where created_at > now() - interval '1 day';  -- 20 invites/day
select public.cancel_match(id, 'test reset') from public.matches           -- 3 hosted matches
  where creator_id = '<your test user>'
    and status in ('draft', 'open', 'full', 'ready_to_book');
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
- [ ] No `security definer` function left at the default grant. A function in
      `public` with no explicit ACL is callable by `anon` through PostgREST, and
      `security definer` runs it with RLS bypassed — that combination publishes
      an internal helper as an API with no authorization of its own. Re-run
      whenever a migration adds one (2026-08-29 decision):

  ```sql
  select p.proname,
         coalesce(array_to_string(p.proacl::text[], ' '), '(default grant)') as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype <> 'trigger'::regtype::oid
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  ```

  Must return no rows. Trigger functions are excluded: they cannot be invoked
  without OLD and NEW.

  Asks whether `anon` can actually execute, rather than whether the ACL is
  empty. An earlier version tested `proacl is null` and so only caught
  functions left at the _default_ grant — `set_own_skill_band` and
  `set_player_preferred_zones` were revoked `from public` without `anon`, kept
  their explicit `anon` grant, and passed it. Supabase's own `get_advisors`
  caught them on staging; migration `096` fixed them.

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
- [ ] Club data-processing terms signed with partner clubs (out of band) — **not applicable to cohort 1**, which shares no player data with any club: players message the club themselves on its public WhatsApp

## 7. Observability and incident response

- [ ] Sentry receiving events from staging build (scrub PII per `docs/TESTING_SECURITY.md`)
- [x] PostHog stays off until consent copy is approved (not in the client today)
- [x] On-call / ops owner named for booking disputes and moderation queue (Ali Moghnieh)
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
- [x] `select * from cron.job where jobname = 'tennis_process_notifications';`
      shows the job active on staging (`*/5 * * * *`, verified 2026-08-30)
- [ ] Both Vault secrets created in the target environment, and
      `select public.invoke_process_notifications();` returned a request id
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

Reaching club staff out of band needs a decision **before any club depends on a nudge** — which is not before cohort 1. Cohort 1 creates no club staff accounts and sends nothing to a club dashboard (2026-08-19 decision), so nothing is waiting on this. The options:

| Option                     | Needs                                               |
| -------------------------- | --------------------------------------------------- |
| Transactional email        | Provider account and API key (none in the repo yet) |
| WhatsApp Business sender   | Meta business verification; matches how clubs work  |
| Dashboard-only, ops-driven | A human pings clubs; viable only at single digits   |

- [ ] Channel chosen and recorded in `docs/DECISIONS.md` — **not applicable to cohort 1**
- [ ] If ops-driven: named owner and expected response time agreed with clubs — **not applicable to cohort 1**

## 8. Promotion sign-off

| Role              | Name | Date | Notes |
| ----------------- | ---- | ---- | ----- |
| Engineering       |      |      |       |
| Product / founder |      |      |       |
| Club operations   |      |      |       |

Do **not** promote if any item in `docs/TESTING_SECURITY.md` pre-release gate fails.
