# User Flows and Screen Inventory

## Mobile navigation

Primary tabs after onboarding:

1. **Home** — next action, upcoming match, open requests, quick create
2. **Discover** — open matches and compatible players
3. **Create** — prominent modal/flow, not a persistent content feed
4. **Matches** — pending invites inbox and active matches
5. **Profile** — availability, preferences, reliability, settings

## Player screens

### Entry and onboarding

- Welcome / value proposition
- Sign in / create account
- Contact verification
- Terms, privacy, community rules consent
- Basic identity: display name, adult confirmation/birth year, languages
- Tennis profile: provisional skill questionnaire, play intent, format preference
- Area and availability setup
- Notification permission primer
- Onboarding complete

### Home and discovery

- Home dashboard
- Open-match discovery with filters
- Compatible-player discovery with filters
- Public player profile
- Public match details
- Join confirmation or join-request state

### Match creation and coordination

- Create match: format and intent
- Create match: level, visibility, join approval
- Create match: areas and proposed times
- Create match: review and publish
- Invite player / share link
- Matches tab: **Invites** inbox (accept/decline) and **Active** list
- Match hub
- Time voting
- Participant list
- Match chat
- Select club/court
- Submit booking request
- Booking pending / accepted / alternative / rejected
- Cancel or leave flow with policy impact

### Completion and account

- Attendance confirmation
- Submit result
- Confirm/dispute result
- Rating explanation/history
- Report/block flow
- Notifications center
- Availability editor
- Profile editor
- Language, privacy, and notification settings
- Support and account deletion request

## Club dashboard routes

- `/login`
- `/dashboard` — today’s queue and alerts
- `/bookings` — searchable request list
- `/bookings/[id]` — request detail and actions
- `/calendar` — accepted bookings and blocks
- `/courts` — court settings
- `/hours` — operating and exceptional hours
- `/staff` — club-admin only
- `/settings` — club information and policy

## Platform admin routes

- `/admin/reports`
- `/admin/disputes`
- `/admin/users/[id]`
- `/admin/clubs`
- `/admin/audit`
- `/admin/jobs`

Keep the platform admin surface visually distinct and guarded by a separate role check.

## Critical flows

### Flow A — Find and join a public match

1. Player opens Discover.
2. App applies saved zone, level, and availability preferences.
3. Player opens an eligible match.
4. App shows compatibility, proposed times, participants, and join behavior.
5. Player joins or requests approval.
6. Creator approves if required.
7. Participant votes on proposed times.
8. When capacity and agreement are complete, match becomes ready to book.

Failure states: full match, withdrawn time, blocked user, creator rejection, expired match, lost connection, concurrent final spot.

### Flow B — Create a match and request a court

1. Creator chooses singles/doubles and social/competitive.
2. Adds visibility, level range, zones, and proposed times.
3. Publishes and invites players.
4. Match fills; all participants agree on one time.
5. Creator chooses a club/court and sees indicative price plus “confirmation required.”
6. Booking request enters the club queue.
7. Club accepts, rejects, or proposes an alternative.
8. Participants receive notification and the hub shows the next action.

Failure states: no club coverage, court no longer available, club timeout, alternative declined, participant leaves, weather cancellation.

### Flow C — Club processes a request

1. Staff signs in and sees assigned-club queue.
2. Opens request with court, time, duration, match size, and operational note.
3. Checks actual availability.
4. Accepts, rejects with reason, or proposes alternative.
5. System writes booking event, enforces no overlap, and notifies participants.

Failure states: another staff member acted first, overlapping acceptance, stale page, revoked membership.

### Flow D — Complete match and update rating

1. After scheduled time, participants receive attendance prompt.
2. One participant submits result.
3. Opponent confirms or disputes.
4. If confirmed, server finalizes result once and updates rating history once.
5. Completed match appears in history.
6. Dispute routes to platform operations without rating change.

## Required state design

Every async screen needs:

- skeleton/loading state
- useful empty state
- recoverable error state
- offline state where relevant
- stale-data indicator for operational queues
- success confirmation
- destructive-action confirmation

Every match/booking screen must show both the current state and the single next action expected from the viewer.
