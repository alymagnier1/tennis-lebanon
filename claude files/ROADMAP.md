# Development Roadmap

Build vertical slices. Each milestone must produce demonstrable behavior, tests, and a deployable state.

## Milestone 0 — Repository and delivery foundations

Deliver:

- pnpm/Turborepo monorepo
- Expo mobile and Next.js dashboard shells
- strict TypeScript, lint, formatting, pre-commit checks
- Supabase local development and migration command
- validated environment configuration and `.env.example`
- CI for lint, typecheck, unit tests, and migration validation
- base design tokens and i18n scaffolding including Arabic RTL test screen
- Sentry wiring disabled safely when DSN is absent
- `supabase/seed.sql` seeding a minimal set of pilot zones and test identities (player A, player B, club staff, club admin, platform admin) so Milestone 1–2 work and RLS testing have data to run against

Exit: clean checkout can install, start local services, run both apps, and pass CI using README instructions.

## Milestone 1 — Authentication and onboarding

Deliver E1 end to end, including profile creation trigger, protected routes, consent capture, onboarding progress, and account settings skeleton.

Exit: a new user can authenticate, complete onboarding, sign out/in, and see only authorized data; RLS tests pass.

## Milestone 2 — Zones, availability, and discovery

Deliver E2 with seeded pilot zones and a realistic empty state.

Exit: two test users with overlapping preferences can discover each other; blocked or suspended users cannot.

## Milestone 3 — Match creation, participation, and invitations

Deliver E3 and the basic match hub without chat.

Exit: singles and doubles capacity holds under concurrent join attempts; public/private visibility and block rules pass.

## Milestone 4 — Time voting and match readiness

Deliver E4 and state transitions through `ready_to_book`.

Exit: concurrent votes cannot select an invalid time; every participant sees consistent status and next action.

## Milestone 5 — Clubs, courts, and manual booking dashboard

Deliver E5 and E8 minimum vertical slice.

Exit: assigned club staff accepts/rejects/proposes a single alternative; unauthorized club staff cannot see or act; accepted overlap is impossible; club admin can set indicative prices and operating hours, and both are visible in the club/court directory used by E5.

## Milestone 6 — Chat and notifications

Deliver E6 with participant-only Realtime chat, push token management, a notification outbox/job, and deep linking.

Exit: former/non-participants cannot read chat; duplicated jobs do not generate duplicate notifications; sensitive data is absent from logs/analytics.

## Milestone 7 — Attendance, results, rating, and disputes

Deliver E7 including an idempotent rating function and operations dispute queue.

Exit: repeated requests cannot double-apply rating; disputed results remain unrated; audit trail is complete.

## Milestone 8 — Pilot hardening

Deliver:

- report/block flows and admin queue
- cancellation/no-show rules chosen with pilot clubs
- performance/accessibility review
- backup/restore drill
- staging-to-production checklist
- app-store privacy disclosures and deletion/support workflow
- seeded demo accounts and pilot operations guide
- Arabic copy review complete for all critical flows (interface RTL scaffolding was done in Milestone 0; this closes out full translation)
- submit builds to TestFlight and Play internal testing at least 1–2 weeks before the intended pilot start date, to absorb store review latency

Exit: all release gates in `TESTING_SECURITY.md` pass and five partner-club workflows have been rehearsed.

## After pilot evidence only

Consider payments, split deposits, coach marketplace, recurring groups, flexible leagues, club promotions, and advanced analytics only after match-completion and retention thresholds are met.
