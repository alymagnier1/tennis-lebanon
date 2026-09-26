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
- [x] No open critical/high security findings — **open**: the staging
      `service_role` key exposed on 2026-09-22 stays valid until §7d is done
  - Closed 2026-09-26: the exposed key is retired (§7d, legacy JWT secret revoked
    15:47:19) and the logs show it was never used. Open review findings are P2 or
    lower (`docs/audits/REHEARSAL_PARTIAL_2026-09-26.md`).
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
  - Verified 2026-09-26: `109` applied with `supabase db push` after #19 merged; staging is 001→109 and the new `register_device_push_token` is live, still `authenticated`-only.
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
- [x] `select count(*) from public.device_push_tokens where is_active;` is
      non-zero on staging after a real device signs in
  - 2026-09-26: **1** active token (phone A) during the partial rehearsal.
  - Unticked 2026-09-26 13:14: **0** active. At 12:47 the phone signed in as a
    different account and every registration since has failed with 409
    (`device_push_tokens_token_key`). Fixed by migration `109`.
  - Re-verified 2026-09-26 13:53 after `109`: **1** active token, the phone's.
    Its first registration after the fix (13:52:40) returned 200 where the same
    account-switch case had returned 409, and replaced the stale row.

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

An emulator cannot stand in for either phone here. Push registration requires
`Device.isDevice` (`apps/mobile/src/lib/push-notifications.ts`), so an emulator
never writes a token row. That is expected, not an FCM fault.

The create screen publishes **fixed-time** matches only (`timingMode` is fixed
and one slot is kept, `apps/mobile/app/match/create/schedule.tsx`), so this
rehearsal follows the fixed journey. Pushes that journey actually produces:
`match_participant_joined` to the host when B accepts, and
`match_court_confirmed` ("Court confirmed") to every other accepted player when
A confirms the court.

- [x] A signs in with Google and turns on Profile → Notifications
  - Partial 2026-09-26: physical phone A; notifications on; 1 active token.
    See `docs/audits/REHEARSAL_PARTIAL_2026-09-26.md`.
- [ ] A creates a singles match at one fixed time and publishes; the schedule
      conflict banner appears only when A already has an agreed match then
  - Partial 2026-09-26: fixed-time publish on update `01a0dcac…` passed. The
    conflict banner was not checked, so the row stays open.
- [x] A shares the invite to B on WhatsApp; the message shows an
      `https://racketbound.com/invite#…` link
  - Partial 2026-09-26: link format confirmed.
- [ ] B taps it: the invite page loads, Get the app installs the APK, Back →
      Open in the app opens RacketBound on the invite screen
  - Unticked: cold install not walked (B already had the app / account).
- [ ] B signs up, confirms the email code, finishes onboarding, and **lands on the
      invite** (not Home); the summary shows zone and time; Accept joins
  - Unticked: cold sign-up path not walked. Accept-from-existing-account passed
    on emulator B (not a substitute for this row).
- [x] **A's phone physically shows** the `match_participant_joined` push for B
      joining
  - Verified 2026-09-26: OS push on phone A after cron (~5 min).
- [ ] B turns on Profile → Notifications; `device_push_tokens` now has two
      active rows, one per phone
  - Unticked: emulator cannot register; still 1 token.
- [ ] A opens the court step, uses the WhatsApp hand-off to the club, then
      confirms the court was booked; both hubs show the confirmed court and
      **B's phone physically shows** the "Court confirmed" push
  - Partial 2026-09-26: hand-off + confirm + both hubs OK; B OS push not
    proved (emulator). Al Riyadi landline triggered WhatsApp SMS invite UI.
- [ ] After the start time: both confirm attendance and the same score; the
      result shows as confirmed and the rematch card appears
- [ ] `select * from public.unreachable_notification_summary();` reviewed, and
      Sentry checked for `stage: expo-push-token` / `register-device-push-token`
- [ ] Invite edge cases on the phone (migration 108): Decline on a **shared** link
      leaves the screen with no error and the link still works for someone else;
      Decline on an **addressed** invite records the refusal; a player **blocked**
      by the host sees "This invite link is not valid" and no match details; a
      player outside the match's level sees the level message, not Accept
  - Partial 2026-09-26: shared Decline, addressed Decline, and out-of-level
    passed. **Blocked** skipped. Full row stays open until blocked is done.
- [x] One recoverable failure: turn data off mid-flow, turn it back on, and the
      screen recovers without restarting the app
  - Verified 2026-09-26 on phone A.
- [ ] Recorded: APK build id and commit, each phone's model and Android version,
      the backend state (migration version, function version), and every failure
  - Partial 2026-09-26: build/update/migration/findings in
    `docs/audits/REHEARSAL_PARTIAL_2026-09-26.md`. **Phone model and Android
    version still TBD** — leave unticked until filled in.
- [x] Anything that surprised either player written down before it is fixed
  - Findings in that audit (false offline on emulator, cancelled-invite copy,
    invite hash stripping, landline WhatsApp, bell vs OS push).

Two paths this rehearsal does **not** cover, and must not be ticked from it:

- Accepting a shared invite joins directly. It is not a join request, so it
  proves nothing about a host approving one.
- A fixed-match run never votes, so it proves nothing about flexible voting or
  the agreed-time push.

- [ ] Join request and approval on two phones: A publishes with Discover listing
      and "requires approval" on; B requests from Discover; **A's phone shows**
      the join-request push; A approves; **B's phone shows** the request-accepted
      push
  - Partial 2026-09-26: request + approve + **A** OS `match_join_request` push
    proved. B request-accepted OS push not proved (emulator). Row stays open.
- [ ] Flexible time voting: either recorded as out of cohort-1 scope in
      `docs/DECISIONS.md`, or a supported way to create a flexible match specified
      and tested separately. The create screen cannot publish one today

## 7d. Retire the legacy Supabase keys (before any real player)

See the 2026-09-25 decision. Phase 1 is in the repo; phase 2 is dashboard-only.

- [x] Vercel: `NEXT_PUBLIC_SUPABASE_ANON_KEY` holds the `sb_publishable_...` key;
      `SUPABASE_SERVICE_ROLE_KEY` deleted (the code never reads it); redeployed
  - Verified 2026-09-25: publishable key in the live bundle, no legacy JWT; service-role variable removed by the founder; redeployed.
- [x] `select left(content::text, 200) from net._http_response order by created desc limit 1;`
      shows `"keySource":"secret"`
  - Verified 2026-09-25: `"keySource":"secret"` from function v4.
- [x] EAS environment variable `EXPO_PUBLIC_SUPABASE_ANON_KEY` holds the publishable
      key in every EAS environment, not only the staging profile's `eas.json`
  - Unticked 2026-09-25: an update exported through `eas env:exec preview` had
    inlined the legacy anon JWT.
  - Verified 2026-09-26 after the founder's fix: preview and production hold the
    publishable key for the staging project (development sets none; it reads the
    local `.env`), and a test bundle exported through preview carries the
    publishable key and no JWT. Nothing was published by that check.
- [x] Inventory confirmed: every EAS profile and update environment, installed
      builds, Vercel (Production and Preview), cron / `pg_net`, CI, local `.env`
  - Confirmed 2026-09-26: EAS preview/production env and `eas.json` staging hold
    the publishable key; build `168b2257` was built from `eas.json`; Vercel holds
    the publishable key (Production verified in the live bundle 09-25) and no
    service-role variable; the cron invoker uses its own
    token and the sender the `sb_secret` key; CI holds no Supabase secrets. No
    request was rejected for a legacy API key after the deactivation, so nothing
    in use still sends one.
  - Local, not in git: the root `.env` and `apps/mobile/.env` still carry the
    legacy staging `anon` key, which no longer works. Swap in the publishable key
    before running locally against staging.
- [ ] New EAS build (publishable key from `eas.json`) installed on every test phone
- [x] **The running update confirmed, not assumed.** Updates download in the
      background and run after a full restart, so opening the app twice proves
      nothing. Settings → the line under the version must read
      `Runtime 0.1.0 · staging · downloaded update` and `Update <id>`, where `<id>`
      equals the latest Android update ID on the EAS dashboard
  - Verified 2026-09-26 on phone A and emulator: Update `01a0dcac…`.
  - Update `01a0dd7a…` (this-device sign-out) published 2026-09-26 14:30. Confirm
    it is running before the remaining §7c rehearsal.
- [x] **Focused compatibility check** on that build: fresh sign-in, open a match
      hub, open an invite preview, one reversible write, and the sender returning 200. Do not wait for the full §7c rehearsal — retire first, then repeat this
      check, then rehearse against the final configuration
  - Verified 2026-09-26: T3–T6 on phone A; sender returning 200 (checked same day).
  - The T3 sign-in used a **different account** from the rehearsal's A. That
    exposed the push-token bug fixed by migration `109`: the new account could
    not register the phone's token.
  - Repeated after the revoke (2026-09-26): fresh sign-in (emulator 15:51), match
    hub (phone 15:51 and 16:08), sender 200 (15:50). Not yet repeated: an invite
    preview and one reversible write (handover T5–T6).
- [x] **Session refresh**, recorded separately from the fresh sign-in (signing
      out and in makes a new session and never uses the refresh token): leave a
      phone signed in past the access-token lifetime, bring the app to the
      foreground, then open a match hub without being asked to sign in. Auth logs
      show a successful `refresh_token` grant for that user at that time. Repeat
      after retirement, against the final key configuration. Never log the
      tokens themselves
  - Verified 2026-09-26 before retirement: at 14:57:04 the phone's session renewed
    (`refresh_token` grant, 200) and a match hub loaded without a sign-in prompt.
  - Verified 2026-09-26 after retirement: at 16:08:37 the renewal returned 200 and
    the match hub loaded with a token signed by the new key (ES256, `74cd036a…`).
- [x] Supabase → Settings → API Keys: legacy `anon` and `service_role` **deactivated**;
      sign-in, a match hub and the sender (200) still work
  - Done 2026-09-26 (recorded 12:54): founder disabled the JWT-based API keys on staging.
    Afterwards match hubs loaded (200, through 13:08) and the sender answered 200
    (through 13:10); no 401/403 anywhere.
  - Sign-in verified 2026-09-26 13:52: fresh Google sign-ins succeeded on the
    emulator and on the phone (auth logs, 200), with no 401/403.
- [x] Supabase → Settings → JWT Keys: **Migrate JWT secret** → **Rotate** → wait the
      access-token lifetime **plus 15 minutes** (1 h 15 min at the default 1 h; read
      the actual value in Auth settings) → **Revoke** the legacy secret. Rotation
      without revocation leaves the old key valid. In an active incident, revoking
      immediately and accepting a session interruption is also acceptable. Only
      after revocation is the leaked 2026-09-22 key worthless
  - Done 2026-09-26: migrated and rotated before 14:19 (current key ECC
    `74cd036a…`); legacy `4d017fdb…` revoked at **15:47:19** Beirut (12:47:19 UTC),
    over 1 h 15 min after the rotation (access-token expiry 3600 s). Afterwards
    every device request carried a token signed by the new key, and none was
    rejected.
- [x] Recorded: the cutoff time; logs reviewed for unexpected privileged activity
      during the exposure window (2026-09-22 → cutoff); rejection of the retired
      key verified through a controlled check — never by pasting the key into
      chat or logs
  - Cutoff: 2026-09-26 15:47:19 Beirut.
  - Exposure began 2026-09-22 about 23:14 Beirut; edge logs are kept from 20:06
    that day, so the whole window is covered. Every request carrying a
    `service_role` JWT, as API key or bearer, from exposure to cutoff: **none**.
    The logs do record roles for that period (`anon`, `authenticated`,
    `supabase_admin`), and the sender used the `sb_secret` key throughout.
  - Controlled check after the cutoff with a made-up HS256 token, never the real
    key: data API 401 (`PGRST301`, no suitable key), Auth admin 403 ("signing
    method HS256 is invalid"), Storage rejected, legacy-format API key 401
    ("Invalid API key"). The leaked key is an HS256 token, so it is rejected
    everywhere.

## 8. Promotion sign-off

| Role              | Name | Date | Notes |
| ----------------- | ---- | ---- | ----- |
| Engineering       |      |      |       |
| Product / founder |      |      |       |
| Club operations   |      |      |       |

Do **not** promote if any item in `docs/TESTING_SECURITY.md` pre-release gate fails.
