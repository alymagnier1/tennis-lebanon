# Tennis Lebanon — Claude Code Build Package

This folder is the source of truth for a lean Lebanon-first tennis matchmaking and court-booking MVP. The working product name is **Tennis Lebanon**; rename it before release.

## Product promise

Help a player move from **“I want to play”** to a **confirmed opponent, time, and court** in one reliable flow.

The MVP is matchmaking-first. Clubs can accept booking requests through a lightweight web dashboard. Payments, tournaments, coaches, video analysis, a social feed, and other sports are intentionally deferred.

## Recommended stack

- Mobile: React Native + Expo + TypeScript + Expo Router
- Dashboard: Next.js App Router + TypeScript
- Backend: Supabase Auth, Postgres, Storage, Realtime, and Edge Functions where server-only logic is required
- Monorepo: pnpm workspaces + Turborepo
- Data fetching: TanStack Query
- Forms and validation: React Hook Form + Zod
- Mobile state: local component state first; Zustand only for cross-screen ephemeral state
- Styling: NativeWind or a small token-based component system; choose one and document it
- Observability: Sentry
- Product analytics: PostHog, enabled only after consent requirements are defined
- Tests: Vitest/Jest, React Native Testing Library, Playwright for the dashboard, Maestro for a few mobile end-to-end flows

Do not pin framework versions until project initialization. Use mutually compatible current stable releases and commit the lockfile.

## Read in this order

1. `CLAUDE.md` — permanent instructions for Claude Code
2. `docs/PRD.md` — scope, rules, stories, and acceptance criteria
3. `docs/FLOWS_AND_SCREENS.md` — navigation and user journeys
4. `docs/ARCHITECTURE.md` — repository and system design
5. `docs/DATABASE.md` — data model and access rules
6. `docs/ROADMAP.md` — implementation sequence and definition of done
7. `docs/TESTING_SECURITY.md` — release gates
8. `supabase/migrations/001_initial_schema.sql` — initial database schema
9. `prompts/01_bootstrap.md` — first Claude Code prompt

## Start here

1. Put this package at the root of a new Git repository.
2. Open the repository in Claude Code.
3. Give Claude the prompt in `prompts/01_bootstrap.md`.
4. Review the proposed dependency versions and file plan before allowing implementation.
5. Build one milestone at a time. Do not ask Claude to implement the whole app in one run.

## Decisions that still require founder input

- Final product name and brand
- Pilot geography: recommended starting point is one dense corridor, not all Lebanon
- Whether juniors are excluded from v1 or require guardian-managed accounts
- Initial authentication: email magic link, OTP/SMS, or Apple/Google sign-in
- Exact skill labels used in onboarding
- First 5–8 partner clubs and their booking workflow
- Cancellation and no-show rules agreed with those clubs
- Arabic launch requirement: interface-ready from day one, complete Arabic copy can follow during the pilot
- Gender preference in matching: whether it is offered at all, pending legal/product approval; this determines whether a schema column exists, so decide before Milestone 3
- If OTP/SMS is chosen as the authentication method: confirm delivery reliability and cost with a local carrier/aggregator, and whether WhatsApp OTP is a viable fallback, before Milestone 1
- Whether WhatsApp (in addition to push) should be a notification channel for reminders and booking-status updates, not only for user-initiated invite sharing
- Target Supabase project region/hosting to minimize latency for Lebanese mobile users
- Applicable data protection law/framework to reference for the pilot (Lebanese law and/or a voluntary GDPR-equivalent baseline)

Until these are decided, keep them configurable and do not invent irreversible product rules.
