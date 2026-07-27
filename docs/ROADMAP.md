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

## Milestone 3.5 — Player invites inbox and card CTAs

Thin vertical slice before M4. Adapts competitor UX (e.g. RacketPal-style player outreach) without changing the match-first lifecycle from M3.

Deliver:

- **Invites** surface on the Matches tab (or dedicated sub-tab): pending match invitations for the signed-in player
- `list_my_match_invites` (or equivalent) RPC reading targeted `match_invitations` rows
- Accept / decline from the inbox; accept uses the same join semantics as `accept_match_invite`
- **Multi-invite**: creator can invite multiple players to one open match from player cards (singles: first accept wins and closes other pending invites; doubles: until capacity)
- **Player card CTAs**: from Discover → player profile, clear paths to **create match for this player** (pre-filled context where possible) and **invite to existing open match**
- Optional polish: **last active** hint on public player cards (no premium gate)

Explicitly out of scope for M3.5: push notifications (M6), chat-first coordination, social feed.

Exit: Player A can invite B and D from player cards; B and D see invites in-app without a WhatsApp link; accept lands both in the match hub with correct capacity rules; decline removes the invite for that viewer.

**P0 (shipped):** one active hosted match per format (`open` / `full` / `ready_to_book`); create screen redirects to invite; creator can cancel through `ready_to_book`.

**P1 (before pilot):** stale-match badges on Matches tab; “Still looking?” extend; `expire_stale_matches` job per `docs/LIFECYCLE.md` (24h grace after last proposed time, 7-day open cap).

**P2 (M6):** expiry and stale-match reminder notifications with deep links.

## Milestone 4 — Time voting and match readiness

Deliver E4 and state transitions through `ready_to_book`.

Exit: concurrent votes cannot select an invalid time; every participant sees consistent status and next action.

## Milestone 4.5 — Design foundation (UI)

Deliver before M5 so booking screens inherit the same system.

Deliver:

- sky-blue brand tokens and shared mobile primitives (`Avatar`, `PlayerCard`, `MatchCard`, `SegmentTabs`, `ChipSelect`, `BottomSheet`, `EmptyState`)
- **3-step create wizard** (basics → schedule → review/publish)
- restyled **Discover** (filter/sort sheets, player cards with photo + level + preferred areas)
- restyled **Matches** tab (pill tabs, empty states, organise CTA)
- polished **match hub** and **invite** player rows

Exit: anchor player journeys match the reference flow; M5 can build on shared components without a second visual pass.

## Milestone 5 — Clubs, courts, and manual booking dashboard

Deliver E5 and E8 minimum vertical slice.

**M5.1 (this slice — player path + staff RPCs):** booking schema/RPCs, club directory + favourites, hub **Request court** flow, booking status on hub. Staff accept/reject/alternative covered by DB tests (dashboard UI next).

**M5.2 (done):** Next.js club dashboard booking queue, pilot club onboarding, and club admin courts/hours/blocks editors.

**M5.3 (done):** Optional WhatsApp booking mode for clubs (`external_link`); dashboard settings + mobile `Book on WhatsApp` CTA with prefilled message (no phone in directory).

**M3.5 P1 (done):** Stale-match warnings on Matches tab and hub, **Still looking?** listing extend, and `expire_stale_matches` job RPC.

**M6.1 (done):** Participant-only match chat on hub with Realtime updates.

**M6.2 (done):** Expo push token registration per device with secure RPC upsert/deactivate on sign-out and onboarding opt-in.

**M6.3 (done):** Notification outbox, Expo delivery worker, deep links, and stale/expired match reminder enqueue.

**M6.4 (done):** Lifecycle jobs — `start_in_progress_matches`, `booking_stale_reminders`, `pg_cron` schedules, and `process-notifications` orchestration.

**Player mobile (match-first booking — not chat-first, not instant book):**

- **Club directory**: browse pilot clubs by zone with photos, courts, surface, indoor/outdoor, indicative price, amenities, contact policy, booking mode, and **pay at club** badge (informational only; no in-app payment)
- **Club detail** screen before requesting
- **Request court** hub shortcut when match status is `ready_to_book`: pick club (favourites and match zones pre-sorted) → court → confirm agreed time → submit one booking request per match
- Booking status visible to all participants: `booking_pending`, accepted, rejected (with reason), `alternative_proposed` (one club counter-offer), confirmed
- **Pay at club** copy on confirmed bookings

**Club dashboard (E8 minimum):**

- Staff queue for assigned clubs only: accept, reject with reason, or propose **one** alternative court/time
- Club admin: courts, indicative prices, operating hours, blocks
- **Pilot club onboarding**: structured admin form to register club profile, courts, and hours (no self-serve API integration required for v1)

**Borrowed UX (RacketPal-inspired, kept lightweight):**

- **Favorite clubs** on player profile; booking picker and discovery can prioritise or filter by shared favourites
- **Coach directory (info only, stretch)**: read-only coach names/contact policy per club detail — no lesson booking or payments in-app

**Explicitly out of scope for M5:** in-app court payment, live availability / instant book (Playtomic-style), chat-first venue coordination, coach marketplace, leagues.

Exit: a full match can request a court from the hub and receive a manual club response end-to-end; assigned club staff accepts/rejects/proposes a single alternative; unauthorized club staff cannot see or act; accepted overlap is impossible; club admin can set indicative prices and operating hours, and both are visible in the directory used by E5.

## Milestone 6 — Chat and notifications

Deliver E6 with participant-only Realtime chat, push token management, a notification outbox/job, and deep linking.

**Chat scope:** match participant chat **supplements** the structured match → time → court flow from M5; it does not replace booking requests or club staff actions. Optional later: “discuss in chat” on the hub while `ready_to_book` — formal request still required.

Also deliver **match hygiene (P2 from M3.5)**:

- `expire_stale_matches` reminder notifications (“expires in 2 days”) with deep link to hub
- generic “match expired” notice to participants (see `docs/LIFECYCLE.md`)

Exit: former/non-participants cannot read chat; duplicated jobs do not generate duplicate notifications; sensitive data is absent from logs/analytics.

## Milestone 7 — Attendance, results, rating, and disputes

Deliver E7 including an idempotent rating function and operations dispute queue.

Display rules (already in `docs/DATABASE.md`): show skill **bands** and a **Provisional** label until five confirmed results; then expose the internal rating number on the player's own profile and public card as earned — not a day-one visible points game.

Exit: repeated requests cannot double-apply rating; disputed results remain unrated; audit trail is complete.

**M7.1 (done):** Attendance recording, result submit/confirm/dispute RPCs, idempotent Elo rating, match hub result panel.

**M7.2 (done):** `schedule_attendance_prompts` job, 15-minute pg_cron, and outbox enqueue for in-progress matches with unknown attendance.

**M7.3 (done):** Custom score entry on the match hub with domain validation and localized error states.

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
- revisit **Google sign-in** (and optionally phone verification for trust) if email magic-link onboarding drop-off warrants it — Facebook login deferred unless data shows clear need

Exit: all release gates in `TESTING_SECURITY.md` pass and five partner-club workflows have been rehearsed.

## After pilot evidence only

Consider payments, split deposits, **full coach marketplace** (scheduling and payments), recurring groups, flexible leagues, club promotions, advanced analytics, **swipe-based Players browse**, and **padel** (same app, `sport` dimension on profiles/matches/clubs) only after tennis match-completion and retention thresholds are met.

## Borrowed UX patterns (not a RacketPal clone)

Steal selectively; keep the structured match → time → court → result engine.

| Pattern | Milestone | Skip for v1 |
| --- | --- | --- |
| Invites inbox + multi-invite + player card CTAs | M3.5 | Chat-first match setup |
| One hosted match per format + cancel through ready_to_book | M3.5 P0 | Unlimited orphan lobbies |
| Stale match badges + auto-expiry job | M3.5 P1 / M6-lite | Permanent open listings |
| Expiry reminder notifications | M6 P2 | Silent match death |
| Last active on player cards | M3.5 (optional) | Premium paywalls for filters |
| Favorite clubs | M5 | Community feed / leagues |
| Rich club directory + hub “Request court” shortcut | M5 | Instant book / in-app court payment |
| Pilot club onboarding form (dashboard) | M5 | Self-serve venue API integrations |
| Coach list (info only) | M5 stretch | Coach booking marketplace |
| Match chat (coordination around booking) | M6 | Chat-first venue coordination |
| Numeric rating after earned matches | M7 | Public “AI” points from casual scores |
| Google / phone auth | M8 if needed | Facebook as priority login |
| Padel second sport | Post-pilot | Multi-sport sprawl during tennis pilot |
