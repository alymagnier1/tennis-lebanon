# Architecture and Product Decisions

Record decisions using this template:

## YYYY-MM-DD — Decision title

- Status: proposed | accepted | superseded
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Owner:

## 2026-07-22 — Matchmaking-first MVP

- Status: accepted
- Context: Lebanon already has broad sports booking products; the unserved core problem is coordinating a compatible opponent, time, and court reliably.
- Decision: Build the completed-match loop first, with lightweight manual club approval.
- Alternatives considered: booking-only marketplace; full club-management system; tennis social network.
- Consequences: payments, coaches, leagues, advanced tournaments, social feed, and other sports are excluded from MVP.
- Owner: Founder

## 2026-07-22 — Shared TypeScript product stack

- Status: proposed
- Context: A solo founder using Claude Code benefits from one language and one cross-platform mobile codebase.
- Decision: Expo/React Native mobile, Next.js dashboard, Supabase backend, TypeScript monorepo.
- Alternatives considered: Flutter; native iOS/Android; Firebase backend.
- Consequences: framework versions must be selected for current compatibility during bootstrap; PostgreSQL/RLS becomes the main authorization boundary.
- Owner: Founder/technical reviewer

## 2026-07-25 — Discovery via Postgres RPCs

- Status: accepted
- Context: Player and open-match discovery requires availability overlap, block exclusion, and privacy-safe projections; client-side filtering would leak calendar data and bypass authorization.
- Decision: Implement `discover_open_matches` and `discover_compatible_players` as validated `security definer` RPCs; list views return coarse compatibility hints only.
- Alternatives considered: PostgREST views with broad RLS; client-side filter after fetching profiles; materialized discovery index refreshed nightly.
- Consequences: M2 migration must include RPCs, rate-limit logging, skill-band rank helper, and SQL tests; mobile uses TanStack Query wrappers only.
- Owner: Founder/technical reviewer

## 2026-07-25 — Exclude gender filtering from v1

- Status: accepted
- Context: PRD mentions gender preference only if legally/product-approved; no safeguarding or legal review completed.
- Decision: No gender filter in MVP create-match or discovery flows.
- Alternatives considered: Optional match-level preference with enum; profile-level gender with strict visibility rules.
- Consequences: Remove gender from pilot UX until explicit legal/product approval; schema unchanged in v1.
- Owner: Founder

## 2026-07-25 — Exclude minors from v1 matchmaking

- Status: accepted
- Context: Junior accounts require guardian consent and communication restrictions not yet designed.
- Decision: Require `is_adult_confirmed = true` before public discovery, match create/join, and chat.
- Alternatives considered: Guardian-managed accounts in v1; age gate without verification.
- Consequences: Birth year collected but minors cannot enter marketplace flows until a later milestone.
- Owner: Founder

## 2026-07-25 — Email magic link authentication for v1

- Status: accepted
- Context: Needed before Milestone 1; SMS OTP has per-message cost and deliverability risk in Lebanon, native social sign-in adds app-store scoping work.
- Decision: Use Supabase Auth email magic link as the only sign-in method for the pilot.
- Alternatives considered: Phone/SMS OTP; Apple/Google social sign-in in addition; combination of all three.
- Consequences: Onboarding flow (E1) designs around email verification only; revisit social sign-in and SMS OTP post-pilot if drop-off data justifies it. Contact verification = verified email.
- Owner: Founder

## 2026-07-25 — Pilot zone geography deferred

- Status: proposed
- Context: Founder has not yet selected the specific dense corridor for the 5–8 partner club pilot.
- Decision: Use placeholder/configurable seed zones for Milestone 0–2 development; real zone names and boundaries to be supplied before pilot seed data is finalized (Milestone 8).
- Alternatives considered: Blocking development until geography is chosen.
- Consequences: `supabase/seed.sql` uses generic placeholder zone names until real geography is provided; must be revisited before pilot launch.
- Owner: Founder

## 2026-07-25 — Match expiry and in_progress via scheduled jobs

- Status: proposed
- Context: State machine included `expired` and `in_progress` without transition rules, affecting discovery and reminders.
- Decision: Hourly expiry for stale/open matches (7-day cap or all proposed times passed + 24h grace); `confirmed → in_progress` at booking start via 5-minute job. See `docs/LIFECYCLE.md`.
- Alternatives considered: Client-only status display without persistence; manual club-only transitions.
- Consequences: M6 adds Edge Function/cron jobs; expired matches drop out of discovery automatically.
- Owner: Founder/technical reviewer

## 2026-07-25 — Supabase hosting region for Lebanon pilot

- Status: proposed
- Context: PRD targets P95 reads under 2 seconds on normal Lebanese mobile connectivity; Supabase has no Middle East primary region.
- Decision: Default staging and production to Central EU (Frankfurt, `eu-central-1`); validate latency from Beirut on pilot devices before production lock.
- Alternatives considered: West EU (Paris/London); Mumbai (higher latency from Lebanon); deferring region choice until M8.
- Consequences: All hosted Supabase projects created at bootstrap should use the same region; revisit read replicas only if measured latency or read load justifies cost.
- Owner: Founder/technical reviewer

## 2026-07-25 — Atomic onboarding completion boundary

- Status: accepted
- Context: E1 writes identity, consent, tennis preferences, and zones across four tables. Partial client writes could incorrectly mark an incomplete or underage profile ready for matchmaking.
- Decision: Create the blank `profiles` row from an `auth.users` trigger, persist encrypted onboarding progress on-device, and finalize all required fields through one `complete_onboarding` database function. The function derives `auth.uid()`, validates adult status and current policy versions, and stamps completion only after every write succeeds.
- Alternatives considered: direct client inserts per screen; a partially complete server-side profile updated after every step; an Edge Function.
- Consequences: incomplete users can resume onboarding but cannot enter main product routes; policy versions and protected account/rating fields are not client-editable.
- Owner: Founder/technical reviewer

## 2026-07-25 — Provisional skill questionnaire v1

- Status: proposed
- Context: E1 requires a short questionnaire, while the exact pilot wording and calibration have not been validated with players.
- Decision: Ask four self-assessment questions (experience, play frequency, rally ability, match experience), score each from 0–4, and map totals to the existing five database bands. Show only the provisional band and never claim UTR/NTRP compatibility.
- Alternatives considered: direct band selection; coach assessment; numeric rating shown immediately.
- Consequences: the scoring stays in the shared domain package, is unit tested, and can be recalibrated before the pilot without changing stored enum values.
- Owner: Founder/product validation

## 2026-07-25 — Development policy and support placeholders

- Status: accepted for development only
- Context: M1 needs versioned consent and a deletion/support path, but approved legal copy and the final support address are not yet available.
- Decision: Use clearly marked `dev-2026-07-25` policy drafts and a `.invalid` local support address. Staging and production configuration reject the placeholder address.
- Alternatives considered: block M1 until legal review; omit policy content; hard-code a personal founder email.
- Consequences: no public pilot may use the development drafts; founder/legal review and a real support address remain release blockers.
- Owner: Founder/legal reviewer

## 2026-07-25 — Completed match definition

- Status: accepted
- Context: PRD north-star metric, LIFECYCLE completion rules, and rating rules used different completion criteria.
- Decision: A completed match requires an accepted booking, required participants, and a mutually confirmed result (or admin resolution). Attendance confirmation alone does not complete a match in v1.
- Alternatives considered: attendance-only completion; "confirmed venue" without a club booking row.
- Consequences: north-star metric, state machine, and rating all use the same bar; PRD and LIFECYCLE aligned.
- Owner: Founder

## 2026-07-25 — Result dispute does not flip match status

- Status: accepted
- Context: `match_status.disputed` and `result_status.disputed` overlapped without clear transition ownership.
- Decision: A disputed result sets `result_status = disputed` while the match remains `completed`. `match_status.disputed` is reserved for explicit platform-admin action on the match itself.
- Alternatives considered: flip match to `disputed` on any result dispute; remove `match_status.disputed`.
- Consequences: match hub can show completed state with a pending result dispute; ops queue uses result status.
- Owner: Founder/technical reviewer

## 2026-07-25 — Unanimous time agreement

- Status: accepted
- Context: PRD said "sufficient participant agreement" while E4/LIFECYCLE implied all required participants must approve one slot.
- Decision: A match becomes `ready_to_book` only when all required participants vote yes on the same time option.
- Alternatives considered: majority vote; creator-selected slot after partial votes.
- Consequences: vote RPC and UI copy use unanimous threshold; no ambiguity in M4 implementation.
- Owner: Founder
