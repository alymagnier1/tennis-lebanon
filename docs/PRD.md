# Product Requirements Document

## 1. Product summary

Tennis Lebanon is a cross-platform mobile marketplace that coordinates a compatible player, suitable time, and tennis court. A lightweight web dashboard lets clubs manage court information and approve booking requests; a platform dashboard supports moderation and operations.

### Target launch users

- Recreational adult tennis players who struggle to find an opponent at the right level and time
- Existing friend groups that want easier coordination and booking
- Tennis clubs that want incremental bookings without replacing their current operating system
- Platform operators managing the pilot manually

### Launch geography

Launch in one dense Lebanese area with approximately 300 verified pilot players and 5–8 partner clubs. Geography is modeled as configurable zones so another city or country can be added without schema changes.

**Partner clubs are a full-pilot ambition, not a cohort-1 bar.** The 5–8 target is not achievable in Beirut alone — four venues there take bookings from non-members, the academies do not rent outside lesson hours, and the rest are members-only — so reaching it means more than one city. Cohort 1 partners with no club at all: venues are listed, and players book on the club's own public WhatsApp. See the two 2026-08-19 decisions in `docs/DECISIONS.md`.

### North-star metric

**Completed matches per week.** A completed match has the required participants and their confirmation that it was played. A score is optional and does not gate completion; a confirmed score (or admin resolution) also completes a match, and an accepted booking is not required. See the 2026-08-15 decision in `docs/DECISIONS.md`.

### Pilot guardrails

- Public-match fill rate
- Median time from creation to full participation
- Confirmed-to-played rate
- Cancellation and no-show rate
- 30-day repeat play after a first completed match
- Court-request conversion: WhatsApp handoff opened to court confirmed. Club response time itself sits outside the product and cannot be read from inside it (2026-08-19 decision)
- Safety reports per 100 matches

## 2. Roles and permissions

### Player

Can manage their own profile and availability, discover players, create/join matches, vote on times, request a booking, chat only in their matches, confirm attendance/results, block/report users, and leave a match within policy.

### Club staff

Can view and act on booking requests for assigned clubs, manage court availability/blocks, check players in, and update operational notes. Cannot access unrelated clubs or private player information.

### Club admin

Has club-staff abilities plus court/pricing configuration and staff membership management for assigned clubs.

### Platform admin

Can manage clubs, resolve reports/disputes, suspend accounts, correct operational state through auditable tools, and view aggregate metrics. Admin actions require a reason.

## 3. Core product rules

### Skill levels

- Onboarding produces a provisional level from a short questionnaire.
- Use human-readable bands during the pilot, for example Beginner, Improving, Intermediate, Advanced, Competitive.
- Store an internal rating separately from the displayed band.
- A rating changes only after a completed match with a mutually confirmed result or an admin resolution.
- Do not claim compatibility with UTR, NTRP, or federation rankings.

### Match formats

- Singles: two required participants.
- Doubles: four required participants.
- Matches may be public, invite-only, or private.
- Creator defines level range, preferred zones, social/competitive intent, and up to three proposed time slots.
- A match becomes `ready_to_book` only when full and all required participants approve one time option.

### Booking

- V1 sends a booking request to a participating club; it is not guaranteed inventory.
- Club accepts, rejects, or proposes an alternative.
- The booking is confirmed only after explicit club acceptance.
- “Pay at club” is an informational payment method in v1.
- A court cannot have overlapping accepted bookings. Enforce this in the database, not only the UI.

### Attendance and reliability

- Send reminders before the match and ask participants to confirm presence afterward.
- Record factual outcomes: attended, cancelled in time, late cancellation, no-show, excused, disputed.
- Reliability is initially private to the user and visible to operations. Public exposure requires a later policy decision.
- Repeated no-shows may limit public-match creation after human review; no automatic permanent bans.

### Messaging and safety

- Only current participants can read/write a match chat.
- Blocked users cannot invite or message each other and should not be recommended together.
- Users can report a player, message, club, or match with a reason and optional note.
- Admins see reports through a queue with an audit trail.

## 4. MVP epics and acceptance criteria

### E1 — Authentication and onboarding

User story: As a new player, I can create an account, verify a contact method, accept policies, and finish a useful tennis profile.

Acceptance criteria:

- Protected app routes require an authenticated session.
- User cannot enter public matchmaking until required profile fields and policy consent are complete.
- Profile includes display name, birth-year/adult status, languages, skill band, play intent, singles/doubles preference, preferred zones, and profile image optional.
- Exact birth date, home address, and live location are not required.
- Account deletion request is available and documented.

### E2 — Availability and discovery

User story: As a player, I can state when/where I play and find compatible people.

Acceptance criteria:

- User can add one-off availability windows and recurring weekly availability.
- Discovery filters by zone, approximate level, match format, play intent, and overlapping availability.
- Results never expose exact private availability outside a match proposal.
- Blocked/suspended users are excluded.
- Empty state suggests safe filter changes.

### E3 — Create, join, and invite

User story: As a player, I can create or join a singles/doubles match and invite someone.

Acceptance criteria:

- Creator chooses format, visibility, level range, intent, zones, notes, and one to three proposed times.
- Public matches appear only to eligible active users.
- Capacity and duplicate participation are database-enforced.
- Join requests can be instant or creator-approved based on match setting.
- Invite link contains an opaque token and does not reveal private match data before authentication/authorization.

### E4 — Time agreement

User story: As a participant, I can vote on proposed times and see when a time is agreed.

Acceptance criteria:

- Participant can mark each proposed time yes/no.
- Match shows vote status without exposing unrelated calendar data.
- Creator can add/withdraw a proposed time before booking is requested.
- A selected time requires agreement from all required participants in v1.
- All state changes are safe under concurrent votes.

### E5 — Clubs, courts, and booking requests

User story: As a full match, we can select a suitable court and receive a clear confirmation or alternative.

Acceptance criteria:

- Club directory shows zone, map point, courts, surface, indoor/outdoor, indicative price, amenities, contact policy, and booking mode.
- Match creator requests one court/time; other participants see the request.
- Assigned club staff can accept, reject with reason, or propose an alternative court/time.
- Accepted bookings are protected against overlap.
- Status history is auditable and visible to affected users.

### E6 — Match hub, chat, and notifications

User story: As a participant, I can see all match details and coordinate safely.

Acceptance criteria:

- Hub shows participants, match/booking state, selected time, court, next action, chat, and cancellation policy.
- Chat is available only to current match participants and authorized admins investigating a report.
- Push notification preferences are respected except essential account/safety notices.
- Notifications are deduplicated and deep-link to the relevant screen.
- Share action uses the device share sheet with a safe invite link.

### E7 — Attendance, result, and rating

User story: After playing, participants can confirm attendance and the score.

Acceptance criteria:

- Attendance window opens after scheduled start and remains editable until a configured deadline.
- Result submission supports common tennis set scores and retirement/walkover markers but does not attempt every tournament rule.
- Opponent must confirm or dispute a submitted result.
- Only one finalized result exists per match.
- Rating update is idempotent, server-controlled, and written to rating history.
- Disputed results do not change rating until resolved.

### E8 — Club dashboard

User story: Club staff can process requests without adopting a complex management system.

Acceptance criteria:

- Staff see requests only for assigned clubs.
- Queue is filterable by status/date/court.
- Accept/reject/alternative actions require a confirmation and write an event.
- Club admin can manage courts, indicative prices, operating hours, and blocks.
- Mobile-width dashboard remains usable.

### E9 — Platform operations

User story: An operator can keep the marketplace safe and correct operational problems.

Acceptance criteria:

- Admin queue includes reports, disputes, suspected duplicate accounts, and failed notification jobs.
- Suspend/restore and dispute-resolution actions require a reason and create audit records.
- Admin impersonation is excluded from v1.
- Private data is masked unless necessary for the case.

## 5. Out of scope for MVP

Payments, wallets, refunds, coaches, lesson scheduling, tournaments, leagues, ladders, video uploads, AI analysis, public feed, equipment sales, ads, wearables, federation rankings, and multi-sport support.

## 6. Non-functional requirements

- Android and iOS from one Expo codebase.
- English UI first, with Arabic RTL and French localization infrastructure working.
- Common screens should remain useful on slow or intermittent mobile connections.
- Optimistic UI only where rollback is safe; bookings/results use confirmed server responses.
- P95 user-facing reads target under 2 seconds on normal Lebanese mobile connectivity after warm-up.
- Crash-free sessions target above 99.5% during pilot.
- All exposed tables use RLS and least privilege.
- Backups, restore procedure, and incident contacts documented before public release.

## 7. Pilot success thresholds

These are decision thresholds, not forecasts:

- 300 verified players
- 5–8 operational partner clubs, across more than one city — see the launch-geography note above; this is not a cohort-1 bar
- 40%+ public-match fill rate, with 50%+ as the healthy line (below roughly 50% filled, the hosting side stops hosting)
- 80%+ confirmed-to-played rate
- 30%+ 30-day repeat play after first completion
- Court-request conversion — WhatsApp handoff opened to court confirmed — trending up, with the bar set from the first cohort's baseline. Replaces the former median-club-response threshold, which is unmeasurable while booking runs on the club's own public WhatsApp
- Less than 5% no-show rate after the initial learning period

Cohort 1 runs against a reduced set of these; see the cohort-1 block in `docs/PILOT_50_PLAYER_LAUNCH.md`.
