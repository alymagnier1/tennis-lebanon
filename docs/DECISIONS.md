# Architecture and Product Decisions

Record decisions using this template:

## YYYY-MM-DD — Decision title

- Status: proposed | accepted | superseded
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Owner:

## 2026-08-03 — v1 ships player-side only; every club is a WhatsApp club

- Status: accepted
- Context: `CLAUDE.md` lists "club dashboard" and "booking request and manual club approval" in the MVP, but the in-app queue cannot work yet: there is no delivery channel to club staff, so a request lands in a dashboard nobody is told about (see the 2026-07-28 entry and the gate in `docs/STAGING_CHECKLIST.md`). Meanwhile the off-app path has become the most developed one in the codebase — any participant may record a court, before or after the roster fills, at whatever hour the club actually gave. Lebanese clubs book over WhatsApp regardless.
- Decision: v1 is the player side alone. Every pilot club is `booking_mode = 'external_link'`, surfaced as a WhatsApp link on the club card, and the player records the booking afterwards with `confirm_external_court`. Recruiting clubs onto a dashboard is deferred until the player side is proven. This defers two items `CLAUDE.md` lists under MVP; that document has not been amended, so it and this entry currently disagree.
- Alternatives considered: ship the club dashboard alongside (blocked on a staff notification channel that does not exist, and asks a pilot club to watch a queue before the app has any players in it); keep both modes live and let clubs choose (the in-app mode looks functional to a player while silently going nowhere, which is worse than not offering it).
- Consequences: no club-side verification — a court record is one player's word, which is acceptable while `payment_method` is always `pay_at_club` and a result still needs mutual confirmation. The app cannot see a walk-in the club booked by phone, so the overlap constraint only protects against two app matches claiming one court. Clubs get no demand visibility, which is a sales problem rather than a technical one. `request_match_booking`, `accept_booking` and the alternative-proposal flow stay in place as dead-for-now code rather than being deleted. **"No club-side app" means no club-staff role, not no dashboard**: result disputes, safety reports and club approvals remain platform-ops surfaces and stay in scope.
- Owner: Founder

## 2026-08-02 — Court-first booking: `confirmed` means roster and court, not court alone

- Status: accepted
- Context: Every booking path required a full roster first — `request_match_booking` (030:281) and `confirm_external_court` (045:856) both called `assert_match_roster_full`, and the latter only ran from `ready_to_book` or `booking_pending`. That is backwards for a Lebanese player holding a club membership: getting a court takes two minutes, finding a fourth is the hard part. The stranded match this whole area keeps working around is a symptom of the ordering.
- Decision: `confirmed` now means **full roster and accepted court**, rather than "an accepted booking exists". A match holding a court while still recruiting keeps its ordinary roster-driven status (`open`/`full`), so discovery, joining, leaving and the host's active-match slot are untouched. `refresh_match_open_state` — already the sole owner of the roster-to-status mapping and already called from every join, leave and invite path — became booking-aware and is now the only thing that writes `confirmed` for the external path. Booking early is creator-only and fixed-timing-only with an agreed time. The court shows in Discover, the matches list and home.
- Alternatives considered: a new `court_secured` status (would have to be threaded through every status list, the discovery filter, joinability, the cancellation policy and three locale files, to express something the pair (roster, booking) already says); extending court-first to the in-app club queue as well (`request_match_booking` moves the match to `booking_pending`, which would make it undiscoverable and unjoinable — decoupling booking status from match status throughout the hub, `next_action` and the awaiting-club banner is a separate, larger change); letting an unfilled court-first match sit indefinitely (`match_should_expire` refused to expire anything holding a booking, so these would accumulate forever and never release the host's slot).
- Consequences: `046_court_first_booking.sql`. `match_should_expire` now distinguishes a pending request (club still deliberating, no expiry) from an accepted court (the court's own hour becomes the deadline). `reschedule_match_time` checks the booking directly, because status alone no longer proves the hour is free. New `court_first_roster_reminders` job warns the host 24 hours out; `list_my_matches` and `discover_open_match_card` carry the court. Court-first is unavailable to flexible-timing matches by design. A court-first match that reaches `confirmed` then loses a player follows the ordinary confirmed rules — `withdraw_from_booked_match`, not `leave_match`.
- Owner: Founder

## 2026-08-02 — Hosts name preferred clubs; off-list courts are announced, not blocked

- Status: accepted
- Context: A player joined knowing only a zone, which in Beirut holds several clubs a half-hour apart at different prices. The venue first became visible after somebody booked it: `get_match_hub` exposes a club name only through the `booking` payload, which does not exist until a court is requested. `confirm_external_court` (041) then notified the group with "a court has been arranged directly with the club" — no club, no time. So the first thing a joiner learned about where they were playing was that the decision had already been made without them.
- Decision: Hosts pick 1–3 clubs at creation, stored in `match_preferred_clubs` and surfaced on the Discover card and the match hub before joining. Required for `public` matches, optional for `invite_only` and `private`. The host's list is authoritative — joining is consent to it. A court recorded at a club outside the list is still accepted, but the notification says so and the audit event carries `off_preferred_list`. The court-confirmed notice now names the club and the Beirut-local hour.
- Alternatives considered: per-joiner club approval with the usable shortlist as the intersection of everyone's picks (deadlocks — four players each accepting a subset of three clubs frequently share none, stalling the match before the roster is even full); blocking off-list courts outright (the agreed club being full at the agreed hour is the ordinary reason somebody rings a second club, so this rebuilds the stranded match that 034 and 041 exist to prevent); leaving the rule client-side only (the parallel `zone_ids` check already lives in `create_match_draft`, so the club check belongs beside it).
- Consequences: `045_match_preferred_clubs.sql`. `create_match_draft` and `create_and_publish_match` gained `p_preferred_club_ids`, so 19 pgTAP fixtures that publish public matches now pass a club. `match_hub_card` and `discover_open_match_card` gained a `preferred_clubs` attribute. A `confirmed` match still does not guarantee a court at a club anyone pre-approved — it guarantees the group is told when it is not. Matches created before this migration have an empty shortlist and are never treated as off-list. Editing the shortlist after creation is not yet possible; a wrong pick means cancelling and recreating.
- Owner: Founder

## 2026-07-28 — Ship the pilot in English and French only

- Status: accepted
- Context: Arabic translations are complete and guarded in CI for key parity, stale placeholders, and real Arabic script. But the app never calls `I18nManager.forceRTL`, so Arabic strings render inside a left-to-right layout: rows, alignment and directional affordances stay LTR on nearly every screen. Only two screens use the manual direction hook. Enabling native RTL is a few days of work plus a device pass, which does not fit before the pilot.
- Decision: Offer only English and French in the language picker (`PILOT_LOCALES`). Keep the Arabic locale files, the `SUPPORTED_LOCALES` list, and every CI guard intact so the translations stay honest and nothing rots.
- Alternatives considered: ship Arabic strings inside an LTR layout (worse than not offering it — it looks broken rather than absent); delete the Arabic locale (loses finished translation work and the CI guard); enable `forceRTL` and accept rough edges on secondary screens (still needs a device pass nobody has run).
- Consequences: Arabic-preferring pilot users get English or French. Founder priority "Arabic RTL must work on critical flows" is explicitly deferred, not silently missed. Re-enabling is a one-line change to `PILOT_LOCALES` once `forceRTL` lands and the critical flows have been walked on a device.
- Owner: Founder

## 2026-07-28 — Park notifications with no delivery channel instead of failing them

- Status: accepted
- Context: Push registration exists only in the mobile app, so club staff working in the web dashboard have no `device_push_tokens` rows. The 4-hour booking nudge is enqueued for them, the Edge Function finds no tokens, and it called `mark_notification_failed('no_active_token')` — burning three retries and then recording a delivery failure. Retrying a push to a device that does not exist can never succeed, and it made "no club has ever been notified" indistinguishable from ordinary transient failures.
- Decision: Add `mark_notification_unreachable`, which parks such rows immediately as `no_delivery_channel` with no retry, plus `unreachable_notification_summary` for operators. Choosing an actual out-of-band channel for club staff is a separate decision, recorded as a hard gate in `docs/STAGING_CHECKLIST.md`.
- Alternatives considered: build transactional email (needs a provider account and secret the project does not have); WhatsApp Business sender (needs Meta verification, but matches how Lebanese clubs actually work); suppress the enqueue entirely for tokenless users (loses the backlog and the evidence).
- Consequences: the message still does not reach club staff — this only stops the signal being lost and the metric being polluted. An ops-driven channel is viable at 5–8 clubs. The gate must be closed before real clubs depend on nudges.
- Owner: Founder

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

## 2026-07-25 — Milestone 3 match RPCs and Matches tab

- Status: accepted
- Context: Match creation, joins, invites, and hub reads must enforce capacity, blocks, and visibility without exposing privileged table writes to clients.
- Decision: Add `007_matches.sql` security-definer RPCs (`create_and_publish_match`, `join_match`, `respond_to_join_request`, `leave_match`, `cancel_match`, `create_match_invite`, `accept_match_invite`, `get_match_hub`, `list_my_matches`); hash invite tokens with `extensions.digest(..., 'sha256')` hex; add a fourth mobile tab **Matches**; all write RPCs are `VOLATILE`.
- Alternatives considered: direct client inserts on `matches` / `match_participants`; storing raw invite tokens in the database; keeping match management on Home only.
- Consequences: mobile uses API wrappers only; share-sheet deep links use `tennislebanon://invite/{token}`; leave/cancel copy uses placeholder policy keys until M8 numeric windows.
- Owner: Founder/technical reviewer

## 2026-07-26 — Leave match reopens discovery and rejoin

- Status: accepted
- Context: On web, `Alert.alert` with cancel/confirm buttons does not invoke destructive callbacks, so leave never ran. Even when leave succeeded, `discover_open_matches` excluded any prior participant row (including `left`), and `join_match` could not reinsert because of the `(match_id, user_id)` primary key.
- Decision: Use `window.confirm` on web for destructive confirmations; treat only active participant statuses (`accepted`, `requested`, `invited`) as discovery exclusions; reactivate `left`/`declined`/`removed` rows on rejoin instead of inserting duplicates.
- Alternatives considered: delete participant rows on leave; show full matches in discover.
- Consequences: departed players can find and rejoin open matches; `009_leave_and_rejoin.sql` updates RPCs accordingly.
- Owner: Founder/technical reviewer

## 2026-07-26 — Milestone 3.5 invites inbox and borrowed player UX

- Status: accepted
- Context: Pilot testing showed that creating a match from a player card does not notify the target player; share-link invites work but are easy to miss. Competitor apps (e.g. RacketPal) emphasize player outreach and in-app invite surfaces. Full chat, feed, leagues, multi-sport, and coach marketplace remain out of MVP scope per PRD.
- Decision: Add **Milestone 3.5** before M4: in-app **Invites** inbox (`list_my_match_invites`, accept/decline), **multi-invite** from player cards with singles first-accept-wins, and clearer **player card CTAs** (create match / invite to open match). Optional **last active** on discover cards. Defer push notifications to M6; defer favorite clubs and read-only coach lists to M5; defer Google/phone auth to M8 unless onboarding metrics require earlier; defer padel to post-pilot.
- Alternatives considered: chat-first coordination like RacketPal; notifications-only without inbox; blocking M4 until invites ship inside M3.
- Consequences: `docs/ROADMAP.md` includes M3.5 and a borrowed-UX table; M3 backend (`match_invitations`, `accept_match_invite`) is extended rather than replaced; match lifecycle (vote → book → play) unchanged.
- Owner: Founder/technical reviewer

## 2026-07-26 — Milestone 4 unanimous time voting

- Status: accepted
- Context: After a match is full, participants must agree on one proposed slot before court booking (M5). Majority vote is insufficient when any player cannot make a time.
- Decision: Add `cast_match_time_vote`, `withdraw_match_time_option`, `add_match_time_option`, and `refresh_match_time_agreement`; transition `full` → `ready_to_book` only when at capacity and every accepted participant has voted `yes` on the same active option; revert to `full` when agreement is lost; extend `get_match_hub` with vote counts and `time_agreed` next action.
- Alternatives considered: first-yes-wins; creator picks time unilaterally; majority vote.
- Consequences: `011_time_voting.sql`; hub shows yes/no per slot; creator can add (max 3 active) or withdraw options before booking; `refresh_match_open_state` clears `selected_time_option_id` when capacity drops.
- Owner: Founder/technical reviewer

## 2026-07-26 — Match-first invite UX (M3.5 refinement)

- Status: accepted
- Context: Pilot flow tied “invite player” to “create new match”, forcing duplicate matches per invite and a four-step create wizard.
- Decision: Single-page create → publish → **Invite players** screen with compatible player cards; player profiles use **Invite to match** when the viewer has an open match, otherwise **Create match**; hub exposes **Invite players** for creators with spare capacity.
- Alternatives considered: keep create-and-invite from player card; chat-first outreach; defer UX until post-pilot polish only.
- Consequences: removes `invitePlayerIds` draft auto-send; old create sub-routes redirect to `/match/create`; acceptance test #1 starts at create → invite screen.
- Owner: Founder/technical reviewer

## 2026-07-26 — One active hosted match per format (P0)

- Status: accepted
- Context: Acceptance testing produced many forgotten `open` 1/2 singles matches; invite and create flows became confusing.
- Decision: Enforce at most one creator-hosted match per `match_format` while `status in ('open', 'full', 'ready_to_book')`; block `create_and_publish_match` with `active_hosted_match_exists`; create UI shows continue-inviting redirect; creator may `cancel_match` through `ready_to_book`.
- Alternatives considered: unlimited matches with UI-only grouping; hard delete of stale rows; global cap across formats.
- Consequences: `012_active_hosted_match_limit.sql`; P1 stale badges + expiry job and P2 reminder notifications tracked in `docs/ROADMAP.md`.
- Owner: Founder/technical reviewer

## 2026-07-26 — M4.5 design foundation (sky blue, reference flow)

- Status: accepted
- Context: M4 acceptance passed; founder provided RacketPal-style references (pill tabs, bottom sheets, chip pickers, organise-game CTA, player cards with avatar/level/location).
- Decision: Add **Milestone 4.5** before M5: switch primary brand to sky blue (`#2ab1f5`), introduce shared mobile UI primitives, restore a **3-step create wizard**, and restyle Discover/Matches/hub/invite anchor screens. Full RTL/animation polish remains post-M5/M6.
- Alternatives considered: full polish only after M6; keep green brand; single-page create with styling only.
- Consequences: `packages/ui` tokens; `apps/mobile/src/components/AppUi.tsx`; create flow routes `details` → `schedule` → `review`; player cards show `avatar_path`, skill band, and zone labels.
- Owner: Founder/technical reviewer

## 2026-07-26 — Create flow visibility as discover toggle

- Status: accepted
- Context: The three-way visibility picker (`public` / `invite_only` / `private`) confused creators during M4.5 setup; most users only need “show on Discover” vs “invite people I choose.”
- Decision: Replace the visibility chip picker with **List on Discover** (maps to `public` when on, `invite_only` when off) plus **Approve join requests** (only when listed). Drop `private` from the create UI; keep the enum in the API/schema for future use.
- Alternatives considered: keep all three options with tooltips; default everything to invite-only; remove approval toggle entirely.
- Consequences: `visibilityFromListOnDiscover` / `listOnDiscoverFromVisibility` in `@tennis-lebanon/domain`; create step 1 grouped into Match type / Match level / Who can join; review summary shows join settings instead of raw visibility labels.
- Owner: Founder/technical reviewer

## 2026-07-26 — Draft-first match creation

- Status: accepted
- Context: Creators reaching the invite screen had matches already live; finishing the flow felt like leaving before publish, and invite-then-publish better matches user mental model.
- Decision: Add `create_match_draft` (status `draft`) and `publish_match`. Review creates a draft; invite screen sends invites on draft; **Publish match** transitions draft → `open`. Invited players only see inbox invites after publish. `create_and_publish_match` remains as draft + publish for atomic callers/tests.
- Alternatives considered: client-only publish flag without DB draft state; allowing invite acceptance before publish.
- Consequences: `013_draft_match_publish.sql`; `draft` counts toward one-hosted-match-per-format limit; `list_my_matches` includes drafts for creator.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5 booking UX (RacketPal borrowings, manual request model)

- Status: accepted
- Context: Competitor apps (e.g. RacketPal) emphasise venue directory, favourite clubs, and shortcuts from an organised match toward a court. Lebanese pilot clubs are unlikely to expose real-time inventory or in-app payments in v1. PRD already requires manual club accept/reject/alternative.
- Decision: M5 delivers a **rich club directory**, **favourite clubs**, and a hub **Request court** shortcut when `ready_to_book`, wired to **manual booking requests** and the E8 staff queue. **Pay at club** is informational copy only. **Pilot club onboarding** uses a structured dashboard form, not venue API integration. **Chat-first venue coordination** stays out of M5; M6 match chat supplements coordination but does not replace booking RPCs.
- Alternatives considered: Playtomic-style instant book and payment; chat-only coordination like early RacketPal flows; deferring directory polish until post-pilot.
- Consequences: `docs/ROADMAP.md` M5/M6 scope and borrowed-UX table updated; implementation must not add payments or guaranteed inventory in M5.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5.1 booking RPCs and creator-only request

- Status: accepted
- Context: First vertical slice for E5 needs DB-enforced booking without a club dashboard UI yet.
- Decision: Add `014_bookings.sql` with alternative columns, `player_favorite_clubs`, and RPCs (`request_match_booking`, staff accept/reject/propose alternative, player respond/cancel). **Only the match creator** may request a court. Match transitions: `ready_to_book` → `booking_pending` → `confirmed` (accept) or back to `ready_to_book` (reject/cancel/decline alternative). Hub `next_action` values: `request_court`, `awaiting_club`, `review_alternative`, `pay_at_club`. Club dashboard UI deferred to M5.2; staff actions verified via DB tests with seeded club staff.
- Alternatives considered: any accepted participant can request; building dashboard queue in the same slice.
- Consequences: mobile hub CTA + `/match/[id]/book` + `/clubs` screens; staff queue pages still pending.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5.2 club dashboard booking queue

- Status: accepted
- Context: M5.1 delivered player booking RPCs and staff mutations tested via SQL; E8 requires a staff UI for accept/reject/alternative.
- Decision: Add `015_club_bookings_queue.sql` with `list_staff_clubs`, `list_club_booking_requests`, and `get_club_booking_detail`. Dashboard routes: `/login`, `/bookings`, `/bookings/[id]` with password sign-in for local dev (seeded club staff). Hours/prices/blocks editors remain a follow-up within M5.2.
- Alternatives considered: magic-link-only auth for staff; server-side SSR session via `@supabase/ssr` in the first slice.
- Consequences: end-to-end manual booking loop testable from mobile request through dashboard response; club admin configuration UI still pending.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5.2 club admin onboarding and configuration

- Status: accepted
- Context: M5.2 booking queue shipped; clubs still needed self-serve profile/court/hour setup for pilot onboarding.
- Decision: Add `016_club_admin.sql` with `register_pilot_club`, admin detail/profile/court/hour RPCs, and staff block RPCs. Dashboard routes: `/onboarding`, `/settings`, `/courts`, `/hours`. One club admin per user in v1; new clubs are active immediately in local pilot (platform review can be added later).
- Alternatives considered: platform-admin-only club creation; mobile club onboarding.
- Consequences: M5.2 complete; M6 chat/notifications is next milestone.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5.3 optional WhatsApp booking mode

- Status: accepted
- Context: Lebanese pilot clubs often prefer WhatsApp for court booking. Schema already had `booking_mode = external_link` and `club_private_contacts.booking_phone`, but no admin UI or player flow.
- Decision: Clubs may opt into **WhatsApp booking** (`external_link`) with a private booking phone configured in dashboard settings. Players see **Book on WhatsApp** (not the raw number) on club detail and match booking screens; tapping fetches a server-built `wa.me` payload with prefilled match context. In-app `manual_request` flow remains default and unchanged.
- Alternatives considered: showing phone in directory cards; replacing in-app booking entirely; chat-first coordination only.
- Consequences: `017_whatsapp_booking.sql`; no audit trail for WhatsApp-only clubs; match status stays `ready_to_book` until players confirm offline.
- Owner: Founder/technical reviewer

## 2026-07-26 — M3.5 P1 stale match expiry and extend

- Status: accepted
- Context: Open matches without activity should not linger forever in discovery. `docs/LIFECYCLE.md` defines 7-day listing cap and 24h grace after proposed times.
- Decision: Add `listing_extended_at`, `expire_stale_matches()` (service-role job), `extend_match_listing()` (**Still looking?** for creators), stale warnings on `list_my_matches` and `get_match_hub`.
- Alternatives considered: auto-expire without warning; chat-only nudges without extend action.
- Consequences: `018_match_expiry.sql`; reminder notifications deferred to M6 P2.
- Owner: Founder/technical reviewer

## 2026-07-26 — M6.1 match participant chat

- Status: accepted
- Context: E6 requires participant-only chat supplementing the structured match flow from M5.
- Decision: RPCs `list_match_messages` and `send_match_message` with accepted-participant gate, 60 messages/hour rate limit, RLS select for Realtime, hub chat panel with live inserts.
- Alternatives considered: chat-first booking; polling-only without Realtime.
- Consequences: `019_match_chat.sql`; push notifications and notification outbox remain M6 follow-up.
- Owner: Founder/technical reviewer

## 2026-07-27 — M6.2 Expo push token registration

- Status: accepted
- Context: M6 requires device token storage before the notification outbox worker can deliver push messages.
- Decision: RPCs `register_device_push_token` and `deactivate_device_push_token` with authenticated upsert per user/device, token reassignment deactivates prior rows, mobile sync on permission grant/app resume, and deactivate on sign-out. Onboarding notifications screen requests OS permission before continuing.
- Alternatives considered: direct table writes from the client; deferring registration until the outbox ships.
- Consequences: `020_push_tokens.sql`; notification outbox and deep links remain M6.3+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M6.3 notification outbox and deep links

- Status: accepted
- Context: M6 requires deduplicated push delivery and deep links before pilot reminders and invite notifications can ship reliably.
- Decision: Add `enqueue_notification`, `claim_due_notifications`, delivery state RPCs, `schedule_stale_match_reminders` + expired-match enqueue in `expire_stale_matches`, targeted invite enqueue in `create_match_invite`, `process-notifications` Edge Function for Expo delivery, and mobile notification deep-link routing.
- Alternatives considered: client-side polling for invites only; direct Expo calls from mobile without outbox.
- Consequences: `021_notification_outbox.sql`; cron must call `run_notification_jobs` then `process-notifications`; booking nudges and attendance prompts remain later M6/M7 slices.
- Owner: Founder/technical reviewer

## 2026-07-27 — M6.4 lifecycle scheduled jobs

- Status: accepted
- Context: `docs/LIFECYCLE.md` requires `confirmed → in_progress` transitions and booking-timeout nudges; M6.3 outbox existed but cron and lifecycle RPCs were not wired.
- Decision: Add `start_in_progress_matches`, `booking_stale_reminders` (4h club nudge / 24h participant notice), extend `run_notification_jobs`, register `pg_cron` schedules for SQL jobs, and have `process-notifications` invoke lifecycle RPCs before claiming due notifications.
- Alternatives considered: client-only status display; separate edge functions per job.
- Consequences: `022_lifecycle_jobs.sql`; production must also schedule `process-notifications` via `pg_net` + Vault (attendance prompts remain M7).
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.1 result workflow and idempotent rating

- Status: accepted
- Context: North-star metric requires mutually confirmed results with server-side rating; schema existed but no RPCs or client flow.
- Decision: Add `record_match_attendance`, `submit_match_result`, `confirm_match_result`, `dispute_match_result`, and `apply_rating_for_result` (Elo v1, K=32, singles only); extend `match_hub_card` with `result` and `viewer_attendance`; mobile hub panel for attendance and result actions.
- Alternatives considered: client-side rating math; attendance-only match completion.
- Consequences: `023_match_results.sql`; admin dispute resolution and attendance notification jobs remain M7.2+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.2 attendance prompt notifications

- Status: accepted
- Context: Participants need a timely nudge to record attendance and move toward result submission after a match starts (`docs/LIFECYCLE.md` `open_attendance_window`).
- Decision: Add `schedule_attendance_prompts` to enqueue deduplicated `attendance_prompt` notifications for accepted participants with `attendance = unknown` on `in_progress` matches past booking start; wire into `run_notification_jobs` and a 15-minute `pg_cron` schedule.
- Alternatives considered: client-only hub banners without push; repeating reminders without deduplication keys.
- Consequences: `024_attendance_prompts.sql`; custom score entry and admin dispute queue remain M7.3+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.3 custom score entry

- Status: accepted
- Context: M7.1 submitted a fixed placeholder score; players need to enter real set scores before confirming results.
- Decision: Add domain-side tennis set validation (winner-perspective sets, 6-4 / 7-6 style), a match hub score editor (winner pick + 1–5 sets), and display formatted scores on the hub card.
- Alternatives considered: free-text score field; server-side tennis rule engine in SQL.
- Consequences: mobile `MatchResultPanel` and `packages/domain/src/results.ts`; admin dispute queue remains M7.5+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.4 provisional vs earned rating display

- Status: accepted
- Context: Rating v1 requires hiding precise numbers until five confirmed results while still showing skill bands (`docs/DATABASE.md`).
- Decision: Add `display_rating` to public player cards (null while provisional), shared domain/mobile formatting helpers, and own-profile progress (`count/threshold`) until earned.
- Alternatives considered: show internal rating everywhere from day one; hide all level information until earned.
- Consequences: `025_provisional_rating_display.sql`; admin dispute queue remains M7.5+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.5 admin result dispute queue

- Status: accepted
- Context: Disputed results must be reviewable by platform operators without database access (`docs/PRD.md`, `docs/FLOWS_AND_SCREENS.md`).
- Decision: Add `list_disputed_results` and `resolve_match_result_dispute` (confirm applies rating + audit; void resolves without rating); expose `/admin/disputes` in the dashboard for platform operators only.
- Alternatives considered: email-only ops workflow; auto-resolve after timeout.
- Consequences: `026_result_dispute_resolution.sql`; completed matches tab remains M7.6+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.6 completed match history

- Status: accepted
- Context: Players need to see finished matches after the north-star loop completes (`docs/FLOWS_AND_SCREENS.md`).
- Decision: Add `list_my_completed_matches` RPC and a **Completed** segment on the mobile Matches tab showing opponent, score, club, and result status.
- Alternatives considered: fold completed rows into Active; separate profile-only history screen.
- Consequences: `027_completed_matches_list.sql`; active list RPC unchanged.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.1 user report and moderation queue

- Status: accepted
- Context: MVP requires report/block flows and an admin queue with audit trail (`docs/PRD.md`, `docs/TESTING_SECURITY.md`).
- Decision: Add `submit_user_report`, `list_open_user_reports`, and `resolve_user_report` RPCs; mobile player report screen; dashboard `/admin/reports` for platform operators. Enforce one report per reporter/target per day.
- Alternatives considered: direct table inserts from clients; email-only reporting.
- Consequences: `028_user_reports_queue.sql`; block flow unchanged from M2.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.2 pilot cancellation and no-show policy

- Status: accepted
- Context: Pilot clubs need predictable leave/cancel/withdraw rules tied to reliability (`docs/LIFECYCLE.md`).
- Decision: Use a configurable 24-hour late-cancel window (`platform_policy_settings.late_cancel_hours`); classify withdrawals as `cancelled_in_time` or `late_cancel`; extend `leave_match` and `cancel_match`; add `withdraw_from_booked_match` for non-creator exits from confirmed matches; require reasons when cancelling after full or withdrawing from booked matches.
- Alternatives considered: fixed no-penalty until match start; club-specific policies per venue.
- Consequences: `029_cancellation_policy.sql`; mobile cancel/withdraw screens with localized `matches.policy.*` copy.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.3 performance and accessibility review

- Status: accepted
- Context: Pilot release gates require usable touch targets, screen-reader labels, dynamic type, and acceptable list performance on discovery (`docs/TESTING_SECURITY.md`).
- Decision: Virtualize discover card lists via `Screen.virtualizedList`, add composite accessibility labels on shared cards, label tabs/chips/toolbars, export `PILOT_CRITICAL_FLOWS` for manual RTL/a11y regression, and improve dashboard login input semantics.
- Alternatives considered: defer virtualization until post-pilot; rely on manual QA only without a flow registry.
- Consequences: no product-rule changes; matches tab remains scroll-mapped for now due to heterogeneous row actions.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.4 pilot operations guide

- Status: accepted
- Context: Milestone 8 exit requires rehearsed partner-club workflows and documented test identities without SQL access (`docs/ROADMAP.md`, `docs/TESTING_SECURITY.md`).
- Decision: Add `docs/PILOT_OPERATIONS.md` with seeded accounts, club references, five workflow rehearsals, and admin escalation paths; export `PILOT_WORKFLOW_REHEARSALS` aligned with `PILOT_CRITICAL_FLOWS`.
- Alternatives considered: wiki-only ops notes; ad-hoc Slack runbook.
- Consequences: placeholder zones/clubs still must be replaced before public pilot; backup/restore drill remains separate.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.5 Arabic copy review for critical flows

- Status: accepted
- Context: Milestone 8 requires full Arabic translation on critical paths, not just RTL scaffolding (`docs/ROADMAP.md`, `docs/TESTING_SECURITY.md`).
- Decision: Add `critical-flow-keys` CI checks (stale placeholder markers, Arabic script on critical keys), remove obsolete `leavePolicyPlaceholder` keys, fix remaining untranslated availability copy, and expose `/rtl-check` from Settings for manual RTL rehearsal.
- Alternatives considered: manual spreadsheet only; blocking release on professional translator review (deferred to pre-public pilot).
- Consequences: dashboard Arabic copy remains out of critical-flow scope; founder should still proofread Arabic UX before go-live.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.6 staging checklist and backup drill

- Status: accepted
- Context: Milestone 8 exit requires rehearsed backup/restore and a staging-to-production promotion checklist (`docs/ROADMAP.md`, `docs/TESTING_SECURITY.md`).
- Decision: Add `docs/STAGING_CHECKLIST.md` and `docs/BACKUP_RESTORE.md`; automate CI-equivalent gates via `pnpm verify:pilot`; add `pnpm drill:backup` for local data round-trip + `db:test` after restore.
- Alternatives considered: wiki-only checklist; relying on Supabase dashboard docs without a repo-local drill script.
- Consequences: hosted staging restore still requires manual Supabase project steps; drill script needs Docker + `psql` locally.
- Owner: Founder/technical reviewer

## 2026-07-29 — M8.7 match lifecycle hardening (audit reconciliation)

- Status: accepted
- Context: Cross-audit reconciliation (Cursor + Claude, July 2026) found a cancelled match could return to `confirmed` when a club alternative survived `cancel_match`, and `leave_match` could race with `request_match_booking` because only the booking path held a row lock.
- Decision: Add `030_match_lifecycle_hardening.sql` with `assert_match_roster_full`; harden `leave_match` (`FOR UPDATE`, reject creator leave); include `alternative_proposed` in `cancel_match` booking cleanup; guard `accept_booking` and `respond_booking_alternative` accept with `match.status = 'booking_pending'`; add `withdraw_booking_alternative` for club staff; move CI format check after lint/typecheck/test so formatting cannot mask regressions.
- Alternatives considered: roster guard only without row lock (insufficient — race remains); club-side-only sweeper for stale alternatives without an explicit withdraw RPC (leaves staff queue blocked until expiry).
- Consequences: new stable errors `match_roster_incomplete` and `creator_should_cancel_match` for client mapping; pgTap coverage in `030_match_lifecycle_hardening_test.sql`.
- Owner: Founder/technical reviewer
