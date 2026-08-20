# 50-Player Pilot Launch Checklist

Ordered runbook to go from **local dev** to a **50+ player closed pilot** in one Lebanese corridor. Full pilot target per `docs/PRD.md` is ~300 verified players and 5–8 partner clubs; treat 50 as **cohort 1** before scaling.

Pair with:

- `docs/STAGING_CHECKLIST.md` — promotion gates
- `docs/PILOT_OPERATIONS.md` — workflow rehearsals
- `docs/TESTING_SECURITY.md` — release gates
- `docs/DECISIONS.md` — v1 ships **player-side first**; pilot clubs use **WhatsApp booking** (`external_link`), not the in-app club queue

---

## How to use this doc

1. Work **top to bottom**. Do not skip Phase 0.
2. Check each box only when the success criterion is met (not “we think it works”).
3. Run **cohort A (10 players)** on staging before opening **cohort B (50+)** on production.
4. Record names, dates, and blockers in the sign-off table at the end.

**Estimated calendar:** 2–4 weeks if accounts (Apple, Google, Supabase, Vercel) are ready. Add **1–2 weeks** for first TestFlight / Play internal review.

---

## Phase 0 — Engineering gates (local, 1–2 days)

Do this before spending money on hosted infra.

| #   | Task                              | Success criterion                                                                                     |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 0.1 | Run automated gates               | `pnpm verify:pilot` passes                                                                            |
| 0.2 | Run database authorization matrix | `pnpm db:test` passes (Docker + local Supabase)                                                       |
| 0.3 | Rehearse four workflows locally   | All rows in `docs/PILOT_OPERATIONS.md` § “Four workflow rehearsals” pass on a fresh `pnpm db:reset`   |
| 0.4 | Fix P0 bugs from rehearsal        | No crashers or dead-ends on auth, onboarding, discover, create/join, hub, WhatsApp handoff, result    |
| 0.5 | Decide pilot geography            | **Done** — Beirut, one zone. See `docs/DECISIONS.md` 2026-08-19 and `supabase/pilot/beirut-zones.sql` |
| 0.6 | Decide pilot locales              | English + French only for cohort 1 (`docs/DECISIONS.md` 2026-07-28)                                   |
| 0.7 | Name ops owner                    | Single inbox + on-call for reports, disputes, and stuck matches                                       |

```powershell
pnpm verify:pilot
pnpm db:test
```

---

## Phase 1 — Hosted backend (staging, 2–3 days)

Create a **dedicated staging** Supabase project (Frankfurt `eu-central-1` per `docs/ARCHITECTURE.md`). Do **not** use local `127.0.0.1` for real testers.

| #    | Task                               | Success criterion                                                                          |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| 1.1  | Create Supabase staging project    | Project ref recorded; separate from any future production project                          |
| 1.2  | Link CLI                           | `supabase link --project-ref <staging-ref>`                                                |
| 1.3  | Push migrations                    | `supabase db push` — all migrations applied, no errors                                     |
| 1.4  | Regenerate types                   | `pnpm db:types` committed if schema changed                                                |
| 1.5  | **Do not run seed.sql on staging** | No `@tennis-lebanon.test` accounts, no fictional clubs in staging/production               |
| 1.6  | Insert real pilot zones            | Run `supabase/pilot/beirut-zones.sql`; its final query must report exactly one active zone |
| 1.7  | Create platform operator           | Your admin user in `platform_roles`; can access `/admin/reports` on dashboard              |
| 1.8  | Configure Auth redirect URLs       | `tennislebanon://auth/callback` added in Supabase Auth → URL configuration                 |
| 1.9  | Configure Auth email               | Supabase built-in email works for magic links **or** custom SMTP configured and tested     |
| 1.10 | Enable RLS spot-check              | Run `pnpm db:test` against linked staging if supported, or manual smoke as two users       |
| 1.11 | Backup drill                       | Follow `docs/BACKUP_RESTORE.md`; record date in sign-off table                             |

**Staging env vars (dashboard + mobile builds):**

| Variable                                                          | Staging value                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| `EXPO_PUBLIC_APP_ENV` / `NEXT_PUBLIC_APP_ENV`                     | `staging`                                              |
| `EXPO_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`           | `https://<ref>.supabase.co`                            |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key                                       |
| `EXPO_PUBLIC_SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL`         | Real monitored inbox (not `*.invalid`)                 |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL`                                   | `tennislebanon://auth/callback`                        |
| `SUPABASE_SERVICE_ROLE_KEY`                                       | Dashboard server only (Vercel secret, never in mobile) |

---

## Phase 2 — Club listings (1–2 days)

v1 pilot model: **you add clubs**; players book via **WhatsApp**, then record the court in-app (`confirm_external_court`). Do **not** promise in-app club approval unless you also staff the dashboard queue.

**Beirut has four bookable venues, not eight.** The original 5–8 target does not survive contact with the city: the tennis academies (Beirut Tennis Club, Rah, Lebanon Tennis Inc, Professional Tennis School) coach and do **not** rent courts outside lesson hours, and the remaining clubs — AUB, Club Sportif Français, Yarze Country Club, Mont La Salle — are members-only and cannot serve a stranger who matched in the app. Chasing eight would mean signing venues your players cannot book. Sign the four that work.

Supply is adequate rather than tight: roughly 6+ courts across the Manara cluster, about 18 prime-time slots on a weekday evening (17:00–22:00, 90-minute matches), against about five matches an evening if 50 players each play weekly. Watch it anyway — if fill rate stalls while `agreed → played` holds, court contention is the first thing to check.

| #   | Task                                                       | Success criterion                                                                                                                                                                       |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Onboard the 4 bookable Beirut venues                       | Renaissance, Al Riyadi and JDK (all at Manara) plus The Private Club (Dekwaneh). Each: name, slug, zone, address, amenities, courts, hours                                              |
| 2.2 | Set `booking_mode = external_link`                         | Every pilot club; WhatsApp number on each club                                                                                                                                          |
| 2.3 | Verify club appears in mobile directory                    | Any signed-in player sees all four in the Clubs tab. The directory is **not** zone-filtered — `useClubsDirectory()` passes no zones — so zone is a label and a search facet, not a gate |
| 2.4 | Test WhatsApp deep link                                    | “Book on WhatsApp” opens with sensible prefilled message; no raw phone in public directory                                                                                              |
| 2.5 | Add club photos (optional)                                 | Upload via dashboard/Storage if ready; empty photo is OK for cohort 1                                                                                                                   |
| 2.6 | Confirm each club takes WhatsApp bookings from non-members | A booking request from a stranger is normal business for them. This is the one fact the pilot depends on                                                                                |
| 2.7 | Record each club's public WhatsApp number                  | Published number only. Never a personal mobile, and never shown raw in the directory                                                                                                    |

**Dashboard path:** log in as platform operator → `/onboarding` → add club (`asOperator` = live immediately, no approval queue).

**No club is a partner.** Cohort 1 asks nothing of any venue: players find a club in the directory, tap through to the club's own public WhatsApp, and book exactly as they would have without the app. Nothing lands in a club dashboard and no staff account is created, so there is no relationship to negotiate before launch, and no club can block it. What the app adds is the part that was hard — finding an opponent at your level who is free at the same hour — not the booking.

Two consequences worth holding on to. Court state in the app is **self-reported**: `confirm_external_court` records what a player says they booked, and nothing verifies it against the club, so a double-booking surfaces at the court, not in the app. And the club's WhatsApp response time is outside your control and unmeasurable from inside the product — the court-request tracking in migration `070` records that a player _left_ for WhatsApp, which is the closest signal available.

---

## Phase 3 — Dashboard deploy (1–2 days)

Club ops and platform moderation run in the Next.js dashboard. Players do **not** use it.

| #   | Task                                 | Success criterion                                                     |
| --- | ------------------------------------ | --------------------------------------------------------------------- |
| 3.1 | Deploy dashboard to Vercel (staging) | Preview/production URL on HTTPS                                       |
| 3.2 | Set Vercel env vars                  | All `NEXT_PUBLIC_*` + `SUPABASE_SERVICE_ROLE_KEY` for staging project |
| 3.3 | Smoke login                          | Platform admin can log in and open `/admin/reports`, `/onboarding`    |
| 3.4 | Smoke club settings                  | Courts and hours editable for a pilot club                            |
| 3.5 | Document ops URLs                    | Team knows staging dashboard URL and login method                     |

---

## Phase 4 — Mobile distribution (3–10 days)

Local Expo (`pnpm dev:mobile`) is **not** usable for 50 testers. You need installable builds.

| #    | Task                         | Success criterion                                                    |
| ---- | ---------------------------- | -------------------------------------------------------------------- |
| 4.1  | Apple Developer account      | Enrolled; Team ID available                                          |
| 4.2  | Google Play Console          | App created; internal testing track ready                            |
| 4.3  | Expo account + EAS           | `eas.json` created with `development`, `preview`, `staging` profiles |
| 4.4  | Configure EAS secrets        | Staging `EXPO_PUBLIC_*` vars in EAS (not committed to git)           |
| 4.5  | iOS bundle ID                | `com.tennislebanon.dev` → decide production ID before public pilot   |
| 4.6  | Android package              | `com.tennislebanon.dev` → same                                       |
| 4.7  | Build staging iOS            | `eas build --platform ios --profile preview` (or staging) succeeds   |
| 4.8  | Build staging Android        | `eas build --platform android --profile preview` succeeds            |
| 4.9  | Submit TestFlight            | Internal testers can install                                         |
| 4.10 | Submit Play internal testing | Testers can install via link                                         |
| 4.11 | Magic link on device         | Real phone: request link → email arrives → tap opens app → signed in |
| 4.12 | Deep links                   | Match hub / invite links open correct screen from cold start         |

**Not in repo yet:** `eas.json` must be added before first build. Plan ~half a day to scaffold profiles and run first builds.

---

## Phase 5 — Notifications and jobs (1–2 days)

Without this, reminders and stale-match nudges are written to the outbox and **never delivered**.

| #   | Task                        | Success criterion                                                                                 |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| 5.1 | Deploy edge function        | `supabase functions deploy process-notifications` to staging                                      |
| 5.2 | Choose invoker              | Cron (GitHub Actions, Vercel cron, or Supabase scheduled trigger) documented                      |
| 5.3 | Schedule invoker            | POST to `process-notifications` every 1–5 minutes with `Authorization: Bearer <service_role_key>` |
| 5.4 | Verify pg_cron enqueue      | Staging DB has scheduled lifecycle jobs (`expire_stale_matches`, etc.)                            |
| 5.5 | **Physical push test**      | One notification arrives on a real device after a test event — not just HTTP 200                  |
| 5.6 | Record invoker in checklist | Fill table in `docs/STAGING_CHECKLIST.md` §7b                                                     |

---

## Phase 6 — Legal, support, and observability (2–7 days, parallel)

Required before **50+ strangers**, not optional polish.

| #   | Task                  | Success criterion                                                              |
| --- | --------------------- | ------------------------------------------------------------------------------ |
| 6.1 | Legal review          | `docs/legal/*` reviewed; production URLs published (not dev drafts)            |
| 6.2 | In-app policy links   | Terms, privacy, community rules open stable HTTPS pages                        |
| 6.3 | Support email live    | `EXPO_PUBLIC_SUPPORT_EMAIL` monitored; response SLA agreed (suggest 48h pilot) |
| 6.4 | Account deletion path | Documented in privacy notice + reachable from app settings                     |
| 6.5 | Sentry staging        | `EXPO_PUBLIC_SENTRY_DSN` set; test crash appears in Sentry project             |
| 6.6 | PostHog               | Off or staging-only until consent copy approved                                |
| 6.7 | Incident contacts     | Named owner for outages, safety reports, disputed results                      |

---

## Phase 7 — Cohort A: closed beta (10–20 players, 3–7 days)

**Goal:** prove the full loop with trusted players before scaling.

| #   | Task                     | Success criterion                                                                  |
| --- | ------------------------ | ---------------------------------------------------------------------------------- |
| 7.1 | Recruit 10–20 players    | Same corridor; mix of skill levels; at least 4 who can play weekly                 |
| 7.2 | Distribute builds        | TestFlight + Play internal links sent                                              |
| 7.3 | Onboarding pass          | ≥80% complete onboarding without ops help                                          |
| 7.4 | Liquidity pass           | ≥3 public matches created; ≥2 joins without manual DB fixes                        |
| 7.5 | WhatsApp booking pass    | ≥1 match records court via WhatsApp + in-app confirm                               |
| 7.6 | Result pass              | ≥1 match reaches mutually confirmed result                                         |
| 7.7 | Arabic device spot-check | Settings → RTL layout check; note issues (Arabic locale hidden per pilot decision) |
| 7.8 | Collect feedback         | Structured form or WhatsApp group; tag bugs P0/P1/P2                               |
| 7.9 | Fix P0/P1                | No blockers for cohort B                                                           |

**Cohort A go/no-go:** if fewer than 2 completed match attempts (booking + show intent), fix discovery/liquidity before inviting 50.

---

## Phase 8 — Production + cohort B (50+ players)

Only after cohort A passes and staging checklist is green.

| #   | Task                                  | Success criterion                                               |
| --- | ------------------------------------- | --------------------------------------------------------------- |
| 8.1 | Create production Supabase project    | Separate from staging; migrations pushed                        |
| 8.2 | Migrate real data                     | Zones + clubs inserted on production (not copied from seed.sql) |
| 8.3 | Production env vars                   | EAS production profile + Vercel production                      |
| 8.4 | Production builds                     | TestFlight / Play production or open testing track              |
| 8.5 | `pnpm verify:pilot` on release commit | CI green                                                        |
| 8.6 | Staging checklist                     | All boxes in `docs/STAGING_CHECKLIST.md` §1–8                   |
| 8.7 | Invite wave 1 (25)                    | Wait 48h; watch Sentry, support inbox, match creation rate      |
| 8.8 | Invite wave 2 (25+)                   | Scale if crash-free sessions stable and ops not underwater      |
| 8.9 | Weekly metrics review                 | Track PRD pilot guardrails (see below)                          |

---

## What to measure (weekly during pilot)

From `docs/PRD.md` §7 — decision thresholds, not forecasts:

| Metric                         | Why it matters                |
| ------------------------------ | ----------------------------- |
| Verified sign-ups vs invites   | Funnel health                 |
| Public-match fill rate         | Discovery liquidity           |
| Median time to full roster     | Matching works                |
| Confirmed-to-played rate       | WhatsApp + show-up loop works |
| 30-day repeat play             | Retention signal              |
| No-show / late-cancel rate     | Policy tuning                 |
| Safety reports per 100 matches | Trust                         |
| Crash-free sessions            | ≥99.5% target                 |

---

## Player flows to rehearse before each wave

Manual smoke in **English and French** on a **physical device**:

1. Magic link sign-in → onboarding → Discover (players + matches)
2. Create match → hub → invite/join → time vote
3. WhatsApp book → record court in app → hub shows court
4. Match chat (if enabled)
5. Attendance → result → confirm
6. Matches tab (invites, active, completed)
7. Clubs directory + detail
8. Report/block (if testing safety)
9. Settings + support link

Registry: `PILOT_CRITICAL_FLOWS` in `@tennis-lebanon/domain`.

---

## Explicitly out of scope for 50-player cohort 1

Do not promise these until post-pilot evidence:

- In-app payments
- Instant court booking / live availability
- Club staff responding inside the dashboard queue (no reliable staff notification channel)
- Arabic in the language picker (translations exist; RTL not pilot-ready)
- Coaches, tournaments, social feed

---

## Rollback plan (write before go-live)

| Layer     | Rollback                                                                           |
| --------- | ---------------------------------------------------------------------------------- |
| Mobile    | Previous TestFlight / Play build promoted; pause new invites                       |
| Dashboard | Vercel instant rollback to last deployment                                         |
| Database  | No migration revert on production without drill; ops uses admin tools for disputes |
| Comms     | Template message to testers if critical bug found                                  |

---

## Sign-off

| Phase                   | Owner | Target date | Done |
| ----------------------- | ----- | ----------- | ---- |
| 0 Engineering gates     |       |             | ☐    |
| 1 Staging backend       |       |             | ☐    |
| 2 Clubs + content       |       |             | ☐    |
| 3 Dashboard deploy      |       |             | ☐    |
| 4 Mobile distribution   |       |             | ☐    |
| 5 Notifications         |       |             | ☐    |
| 6 Legal + observability |       |             | ☐    |
| 7 Cohort A (10–20)      |       |             | ☐    |
| 8 Cohort B (50+)        |       |             | ☐    |

**Notification invoker (required):**

| Setting  | Value                      |
| -------- | -------------------------- |
| Invoker  |                            |
| Schedule |                            |
| Secret   | service role (server only) |

**Go-live approval:**

| Role              | Name | Date |
| ----------------- | ---- | ---- |
| Engineering       |      |      |
| Product / founder |      |      |
| Club operations   |      |      |

---

## Quick reference: local vs pilot

|               | Local dev                 | 50-player pilot              |
| ------------- | ------------------------- | ---------------------------- |
| Supabase      | `127.0.0.1:54321`         | Hosted staging → production  |
| Auth email    | Mailpit `:54324`          | Real SMTP / Supabase email   |
| Mobile        | `pnpm dev:mobile`         | TestFlight / Play internal   |
| Clubs         | Seed or manual local      | Real clubs, `external_link`  |
| Test accounts | `player-a@…` / `password` | Real emails, magic link only |
| Dashboard     | `localhost:3000`          | Vercel HTTPS                 |
| Seed data     | `pnpm db:reset`           | **Never** on production      |
