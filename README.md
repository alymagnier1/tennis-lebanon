# Tennis Lebanon — Claude Code Build Package

This folder is the source of truth for a lean Lebanon-first tennis matchmaking and court-booking MVP. The working product name is **Tennis Lebanon**; rename it before release.

## Product promise

Help a player move from **“I want to play”** to a **confirmed opponent, time, and court** in one reliable flow.

**App summary (one page):** [`docs/APP_SUMMARY.md`](docs/APP_SUMMARY.md)

The MVP is matchmaking-first. Clubs can accept booking requests through a lightweight web dashboard. Payments, tournaments, coaches, video analysis, a social feed, and other sports are intentionally deferred.

## Recommended stack

- Mobile: React Native + Expo + TypeScript + Expo Router
- Dashboard: Next.js App Router + TypeScript
- Backend: Supabase Auth, Postgres, Storage, Realtime, and Edge Functions where server-only logic is required
- Monorepo: pnpm workspaces + Turborepo
- Data fetching: TanStack Query
- Forms and validation: React Hook Form + Zod
- Mobile state: local component state first; Zustand only for cross-screen ephemeral state
- Styling: token-based component system (see `packages/ui`); document any change here
- Observability: Sentry
- Product analytics: PostHog, enabled only after consent requirements are defined
- Tests: Vitest/Jest, React Native Testing Library, Playwright for the dashboard, Maestro for a few mobile end-to-end flows

Do not pin framework versions until project initialization. Use mutually compatible current stable releases and commit the lockfile.

## Read in this order

1. `docs/APP_SUMMARY.md` — what the app is, who it’s for, core journey (start here for overview)
2. `CLAUDE.md` — permanent instructions for Claude Code
3. `docs/PRD.md` — scope, rules, stories, and acceptance criteria
3. `docs/FLOWS_AND_SCREENS.md` — navigation and user journeys
4. `docs/ARCHITECTURE.md` — repository and system design
5. `docs/DATABASE.md` — data model and access rules
6. `docs/DISCOVERY.md` — discovery queries, privacy, and empty states (Milestone 2)
7. `docs/LIFECYCLE.md` — match expiry, in_progress, cancellation placeholders
8. `docs/ROADMAP.md` — implementation sequence and definition of done
9. `docs/TESTING_SECURITY.md` — release gates
10. `supabase/migrations/001_initial_schema.sql` — initial database schema
11. `prompts/01_bootstrap.md` — first Claude Code prompt

## Start here

1. Put this package at the root of a new Git repository.
2. Open the repository in Claude Code.
3. Give Claude the prompt in `prompts/01_bootstrap.md`.
4. Review the proposed dependency versions and file plan before allowing implementation.
5. Build one milestone at a time. Do not ask Claude to implement the whole app in one run.

## Decisions already made (see `docs/DECISIONS.md`)

- Matchmaking-first MVP with manual club approval
- Email magic link as the only v1 sign-in method
- Minors excluded from v1 matchmaking (`is_adult_confirmed` required)
- Gender filtering excluded from v1 (no schema column until legal/product approval)
- Discovery via Postgres RPCs with privacy-safe projections
- Default Supabase hosting region: Central EU (Frankfurt) pending Beirut latency check

## Decisions that still require founder input

- Final product name and brand
- Pilot geography: recommended starting point is one dense corridor, not all Lebanon (placeholder zones in `supabase/seed.sql` until chosen)
- Exact skill labels used in onboarding
- First 5–8 partner clubs and their booking workflow
  - Validate the PRD pilot guardrail of median club response under 30 minutes during stated operating hours with those clubs before treating it as an SLA in dashboard UX (urgency indicators, escalation)
- Cancellation and no-show rules agreed with those clubs
- Arabic launch requirement: interface-ready from day one; full Arabic copy review is Milestone 8 (RTL scaffolding is Milestone 0)
- Transactional notifications: v1 architecture is push-only; decide whether WhatsApp Business API should supplement push for match reminders and booking-status updates (invite sharing via user-initiated WhatsApp share sheet is already in scope; this is a separate notification-channel decision)
- If OTP/SMS is added post-pilot: confirm carrier delivery reliability and per-message cost with a local aggregator; evaluate WhatsApp OTP as a fallback
- Applicable data protection law/framework references for public-release legal review (engineering baseline: Law 81/2018 + voluntary GDPR-equivalent practices — see `docs/TESTING_SECURITY.md`)

Until these are decided, keep them configurable and do not invent irreversible product rules.

## Local development

Requirements: Node from `.nvmrc`, pnpm 10.34.5, and Docker Desktop.

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:start
pnpm db:reset
pnpm dev:mobile
```

The local Supabase API defaults to `http://127.0.0.1:54321`, Studio to
`http://127.0.0.1:54323`, and the development email inbox to
`http://127.0.0.1:54324`. Confirm current values with
`pnpm exec supabase status`.

Never place a service-role key in an `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`
variable. Replace the `.invalid` support email before staging or production;
environment validation intentionally rejects that placeholder outside local
development.

## Milestone 1 authentication

The player app uses email magic links only. For a local sign-in:

1. Enter a test email in the mobile app.
2. Open the local email inbox at `http://127.0.0.1:54324`.
3. Open the newest sign-in message and follow its link to
   `tennislebanon://auth/callback`.
4. Complete consent, identity, provisional skill, format, and zone steps.

Hosted Supabase projects must allow the exact mobile redirect
`tennislebanon://auth/callback`. The checked-in policy documents under
`docs/legal/` are development drafts only and must receive legal review before
the pilot.

Run the Milestone 1 checks with:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:validate
pnpm db:reset
```

The Maestro flow at `e2e/maestro/m1-auth-onboarding.yaml` accepts
`TEST_EMAIL` and a `MAGIC_LINK` copied from the local inbox.
