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

- [x] `pnpm verify:pilot` passes
  - Verified 2026-09-25 on `8058d5a` (the build and update commit): lint, types,
    unit tests, migration checks and format, end to end.
- [x] `pnpm db:test` passes on the release commit
  - Verified 2026-09-25 on `8058d5a`: clean `pnpm db:reset` (001→108), then
    81 files / 351 tests.
- [ ] No open critical/high security findings — **open**: the staging
      `service_role` key exposed on 2026-09-22 stays valid until §7d is done
- [x] Database types regenerated if migrations changed: `pnpm db:types`
  - Verified 2026-09-25 on `8058d5a`: regenerating from 001→108 leaves
    `packages/types` unchanged.

## 2. Environment separation

| Variable         | Staging                     | Production                               |
| ---------------- | --------------------------- | ---------------------------------------- |
| `APP_ENV`        | `staging`                   | `production`                             |
| Supabase project | Dedicated staging project   | Dedicated production project             |
| `SUPPORT_EMAIL`  | Real monitored inbox        | Real monitored inbox (not `*.invalid`)   |
| Sentry DSN       | Staging project             | Production project                       |
| PostHog          | Disabled or staging project | Enabled only after consent copy approved |

- [ ] Staging and production use **separate** Supabase projects (Frankfurt `eu-central-1` per `docs/ARCHITECTURE.md`)
- [x] No service-role key in mobile or browser bundles
  - Verified 2026-09-25: the live dashboard `/login` and `/invite` bundles carry the publishable key and no JWT; `eas.json` staging carries only the publishable key.
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

- [x] All migrations applied to staging in order (`supabase db push` or CI deploy)
  - Verified 2026-09-25: staging `schema_migrations` is 001→108 (105–108 applied with `supabase db push`).
- [ ] Staging smoke: four workflows in `docs/PILOT_OPERATIONS.md` rehearsed
- [ ] Backup/restore drill completed within last 30 days (`docs/BACKUP_RESTORE.md`)
- [ ] `platform_policy_settings`, lifecycle cron (`process-notifications`), and RLS spot-check documented
- [ ] Seed data **not** copied to production (real clubs onboarded via dashboard)

## 4. Mobile release

- [ ] EAS build profiles (`development`, `preview`, `production`) reviewed
- [ ] App version/build number incremented
- [ ] **Native change since the last build?** (a native dependency added, removed or
      upgraded, a config plugin, the Expo SDK, `app.json` native fields) → bump
      `version` in `apps/mobile/app.json` before building. The runtime version is
      the app version (2026-09-25 decision), so a missed bump lets an `eas update`
      reach a build that cannot run it. JS-only changes ship with `eas update`
- [ ] **Publishing an `eas update`:** an update bakes in `EXPO_PUBLIC_*` from where
      it is exported, and does **not** read `eas.json`'s build-profile `env`. So:
  1. Set `EXPO_NO_DOTENV=1`, the `build.staging.env` values from
     `apps/mobile/eas.json`, and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
  2. Export with a cleared cache (without it, Metro reused a bundle with the old
     key inlined on 2026-09-25):
     `npx expo export --platform android --output-dir dist --clear`
  3. Check the bundle: staging URL and the `sb_publishable_` key present; no
     `eyJ…` JWT and no `127.0.0.1`.
  4. Publish exactly that bundle:
     `eas update --skip-bundler --input-dir dist --channel staging --platform android --environment preview`
  - First update published this way 2026-09-25: group `f90371b1-d80e-48a7-83a6-84b2538e183c`,
    runtime `0.1.0`, commit `8058d5a`, bundle checked before upload.
- [ ] Deep links and magic-link redirect URLs match staging/production Supabase auth settings
- [x] Push notification credentials configured for the target environment
  - Confirmed by the founder 2026-09-25: FCM V1 service account key present in EAS credentials for `com.racketbound.app`.
- [ ] TestFlight / Play internal track build uploaded ≥1–2 weeks before pilot start
- [ ] Arabic + English smoke on physical devices (Settings → RTL layout check)

## 5. Dashboard release

- [ ] Vercel preview URL smoke-tested with club-staff flows
- [x] Production domain and HTTPS configured
  - Verified 2026-09-25: `racketbound.com` A record → Vercel, HTTPS live, `www` redirects to the apex, production tracks `staging`.
- [ ] Platform admin routes (`/admin/reports`, `/admin/disputes`) restricted to operators
- [ ] Login form and booking queue tested on Chrome + Safari
- [ ] `NEXT_PUBLIC_GET_APP_URL` set in Vercel to the current install page; without it
      the invite page hides "Get the app" and Android falls back to the bare app scheme

### Invite links

Shared links are `https://racketbound.com/invite#<token>` (see the 2026-09-22
decision). The page is public and static; the token never reaches the server.

- [ ] `/invite#<token>` from WhatsApp on an Android phone **without** the app:
      page loads, "Get the app" reaches the install page, and after installing,
      Back then "Open in the app" opens the invite screen
- [ ] Same link on a phone **with** the app, signed in: "Open in the app" lands on
      the invite summary with Accept / Decline, and nothing is joined until Accept
- [ ] Signed-out path: open the invite, sign up, finish onboarding, and the app
      returns to the invite rather than Home
- [ ] `/invite` with no fragment shows "This invite link is incomplete"
- [ ] Arabic phone: page renders right-to-left

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

The job is inert until both Vault secrets exist and the function has the
matching `PROCESS_NOTIFICATIONS_TOKEN` secret. Set them **per environment**
(they differ between staging and production).

The token is a dedicated random value, **not** the service_role key (changed
2026-09-22: on a project with both legacy and `sb_secret_` keys the function's
`SUPABASE_SERVICE_ROLE_KEY` did not match the key copied from the dashboard,
and every run was answered 401). It lives in exactly two places, so rotating
the service key never breaks notifications.

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/process-notifications',
  'process_notifications_url',
  'Edge Function endpoint invoked by tennis_process_notifications'
);
-- Generates the token and stores it. Use update_secret if it already exists.
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'process_notifications_token',
  'Invoker token for process-notifications; must equal PROCESS_NOTIFICATIONS_TOKEN'
);
-- Copy this value into Edge Functions -> Secrets as PROCESS_NOTIFICATIONS_TOKEN.
select decrypted_secret from vault.decrypted_secrets
where name = 'process_notifications_token';

-- Non-null request id means it fired; null means the secrets are still missing.
select public.invoke_process_notifications();
select * from net._http_response order by created desc limit 5;
```

A 500 reading `PROCESS_NOTIFICATIONS_TOKEN is not configured` means the
function secret is missing; a 401 means the two copies differ.

- [x] Named invoker for `process-notifications` recorded below, with schedule
      and which secret it authenticates with
- [x] `select * from cron.job where jobname = 'tennis_process_notifications';`
      shows the job active on staging (`*/5 * * * *`, verified 2026-08-30)
- [x] Both Vault secrets created in the target environment, and
      `select public.invoke_process_notifications();` returned a request id
  - Verified 2026-09-22/25: invoker returns request ids and the function answers 200 (dedicated `PROCESS_NOTIFICATIONS_TOKEN`).
- [ ] Verified on staging that **one push notification physically arrives** on a
      real device, not merely that the function returned 200
- [ ] `select * from public.unreachable_notification_summary();` reviewed after
      a staging rehearsal

| Setting  | Value                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Invoker  | `pg_cron` job `tennis_process_notifications` → `invoke_process_notifications` |
| Schedule | `*/5 * * * *`                                                                 |
| Secret   | Vault: `process_notifications_url`, `process_notifications_token`             |
| Checked  | Function secret `PROCESS_NOTIFICATIONS_TOKEN` (same value as the Vault token) |

### The mobile app needs an Expo project id

Push registration calls `Notifications.getExpoPushTokenAsync({ projectId })`.
With no project id the call is never made, so **no device registers a token at
all** and every notification is parked as `no_delivery_channel` — the invoker
above will run correctly and still deliver nothing. `apps/mobile/app.config.ts`
reads it from `EAS_PROJECT_ID`; `eas init` writes it into `app.json` instead.
A build missing it now reports to Sentry once per session rather than failing
silently.

- [x] `EAS_PROJECT_ID` set for the build (or present in `app.json`)
  - Verified: `extra.eas.projectId` is in `app.json`.
- [ ] `select count(*) from public.device_push_tokens where is_active;` is
      non-zero on staging after a real device signs in

Onboarding no longer asks for notification permission, so **signing in does
not register a device**. A token is written only after Profile → Notifications
→ enable, or accepting the in-match push prompt. Registration failures are
reported to Sentry with `stage: expo-push-token` or
`stage: register-device-push-token`.

As of 2026-09-22 staging had zero token rows, and every
`invoke_process_notifications` call was answered **401** — see the dedicated
invoker token above. Confirm
`select status_code, count(*) from net._http_response group by 1;` shows 200s.

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

## 7c. Two-player rehearsal (cohort-1 gate)

Two physical Android phones on the current staging APK. **A** is an existing
player; **B** is a person with no account and the app **not installed**. Tick
each step only when it happened on the phone, not when the database says so.

- [ ] A signs in with Google and turns on Profile → Notifications
- [ ] A creates a **flexible** singles match with two proposed times and publishes
- [ ] A shares the invite to B on WhatsApp; the message shows an
      `https://racketbound.com/invite#…` link
- [ ] B taps it: the invite page loads, Get the app installs the APK, Back →
      Open in the app opens RacketBound on the invite screen
- [ ] B signs up, confirms the email code, finishes onboarding, and **lands on the
      invite** (not Home); the summary shows zone and time; Accept joins
- [ ] B turns on Profile → Notifications; `device_push_tokens` now has two
      active rows
- [ ] Both vote Yes on the same slot; **B's phone physically shows** the
      agreed-time push
- [ ] A opens the court step, uses the WhatsApp hand-off to the club, then
      confirms the court was booked; both hubs show the confirmed court
- [ ] After the start time: both confirm attendance and the same score; the
      result shows as confirmed and the rematch card appears
- [ ] `select * from public.unreachable_notification_summary();` reviewed, and
      Sentry checked for `stage: expo-push-token` / `register-device-push-token`
- [ ] Invite edge cases on the phone (migration 108): Decline on a **shared** link
      leaves the screen with no error and the link still works for someone else;
      Decline on an **addressed** invite records the refusal; a player **blocked**
      by the host sees "This invite link is not valid" and no match details; a
      player outside the match's level sees the level message, not Accept
- [ ] One recoverable failure: turn data off mid-flow, turn it back on, and the
      screen recovers without restarting the app
- [ ] Recorded: APK build id and commit, each phone's model and Android version,
      the backend state (migration version, function version), and every failure
- [ ] Anything that surprised either player written down before it is fixed

## 7d. Retire the legacy Supabase keys (before any real player)

See the 2026-09-25 decision. Phase 1 is in the repo; phase 2 is dashboard-only.

- [x] Vercel: `NEXT_PUBLIC_SUPABASE_ANON_KEY` holds the `sb_publishable_...` key;
      `SUPABASE_SERVICE_ROLE_KEY` deleted (the code never reads it); redeployed
  - Verified 2026-09-25: publishable key in the live bundle, no legacy JWT; service-role variable removed by the founder; redeployed.
- [x] `select left(content::text, 200) from net._http_response order by created desc limit 1;`
      shows `"keySource":"secret"`
  - Verified 2026-09-25: `"keySource":"secret"` from function v4.
- [ ] EAS environment variable `EXPO_PUBLIC_SUPABASE_ANON_KEY` holds the publishable
      key in every EAS environment, not only the staging profile's `eas.json`
  - **Unticked 2026-09-25.** Reported done, but an update exported with
    `eas env:exec preview` inlined the legacy anon JWT, so the **preview**
    environment still holds it. Builds are unaffected (the `eas.json` staging value
    wins); updates must set the key explicitly (§4) until every environment is
    fixed.
- [ ] Inventory confirmed: every EAS profile and update environment, installed
      builds, Vercel (Production and Preview), cron / `pg_net`, CI, local `.env`
- [ ] New EAS build (publishable key from `eas.json`) installed on every test phone
      and a **focused compatibility check** passed on it: sign-in, a match hub,
      an invite preview, and the sender returning 200. Do not wait for the full
      §7c rehearsal — retire first, then rehearse against the final configuration
- [ ] Supabase → Settings → API Keys: legacy `anon` and `service_role` **deactivated**;
      sign-in, a match hub and the sender (200) still work
- [ ] Supabase → Settings → JWT Keys: **Migrate JWT secret** → **Rotate** → wait the
      access-token lifetime **plus 15 minutes** (1 h 15 min at the default 1 h; read
      the actual value in Auth settings) → **Revoke** the legacy secret. Rotation
      without revocation leaves the old key valid. In an active incident, revoking
      immediately and accepting a session interruption is also acceptable. Only
      after revocation is the leaked 2026-09-22 key worthless
- [ ] Recorded: the cutoff time; logs reviewed for unexpected privileged activity
      during the exposure window (2026-09-22 → cutoff); rejection of the retired
      key verified through a controlled check — never by pasting the key into
      chat or logs

## 8. Promotion sign-off

| Role              | Name | Date | Notes |
| ----------------- | ---- | ---- | ----- |
| Engineering       |      |      |       |
| Product / founder |      |      |       |
| Club operations   |      |      |       |

Do **not** promote if any item in `docs/TESTING_SECURITY.md` pre-release gate fails.
