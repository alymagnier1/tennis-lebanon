# Database Design

The initial migration is `supabase/migrations/001_initial_schema.sql`. It establishes the core entities and restrictive default access. Add feature-specific RLS policies and RPCs alongside each vertical slice; never turn RLS off to make development easier.

## Entity groups

### Identity and preferences

- `profiles`: public-safe identity attached one-to-one to `auth.users`
- `player_profiles`: tennis preferences and internal rating state
- `zones`: configurable geographic discovery units (see minimum shape in `docs/ARCHITECTURE.md`)
- `player_zones`: preferred play areas
- `availability_windows`: one-off or recurring availability
- `user_blocks`: bilateral safety exclusion initiated by one user
- `user_reports`: moderation queue

### Clubs and courts

- `clubs`: venue profile and approximate map point
- `club_private_contacts`: non-public booking contact details and operational note
- `club_memberships`: staff/admin assignment
- `platform_roles`: server-controlled support/admin assignments
- `courts`: surface and operational metadata
- `court_operating_hours`: recurring weekly hours
- `court_blocks`: maintenance, events, or unavailable periods

### Matches and coordination

- `matches`: core match and state
- `match_participants`: roles, join state, attendance
- `match_time_options`: proposed slots
- `match_time_votes`: one vote per participant/option
- `match_invitations`: targeted or link-based opaque invitations. Tokens expire 14 days after issue or when the match reaches `full`/`cancelled`/`expired`, whichever comes first, and are revoked immediately if the inviter leaves the match. Store tokens hashed; keep the expiry/revocation state on the row, not inferred from the match alone.
- `match_messages`: participant chat

### Booking and completion

- `bookings`: court request and resolution
- `booking_events`: immutable status history
- `match_results`: one result workflow per match
- `rating_events`: append-only rating changes with before/after values

### Delivery and operations

- `device_push_tokens`
- `notifications`
- `audit_events`

## Privacy classification

### Public-safe with restrictions

Display name, avatar, coarse zone preference, skill band, play intent, format preference, and aggregate completed-match count.

### Participant-only

Proposed times, selected time, match notes, participant list for private matches, chat, booking details, attendance, result workflow.

### Operations-only

Report notes, suspension reason, internal reliability data, audit details, notification provider responses.

### Never place in public tables

Raw authentication tokens, secret keys, unmasked contact details, home address, live location, payment credentials, or private analytics identifiers.

## Access policy intent

- Players can read/update their own private data.
- Authenticated users can read active public-safe player cards and public open matches, subject to block/suspension filtering.
- Match details and chat are limited to current participants and appropriate operations staff.
- Club members access bookings and courts only for clubs to which they are assigned.
- Platform-admin access is checked from a server-controlled role, never a client-editable profile field.
- Inserts/updates that affect capacity, overlap, result finalization, rating, or moderation go through controlled database/server functions.

## Authentication and onboarding boundary

- An `auth.users` trigger creates exactly one blank `profiles` row. A blank row
  is not a completed or publicly discoverable player profile.
- `complete_onboarding` derives the user from `auth.uid()` and atomically
  validates and stores identity, adult attestation, current policy versions,
  tennis preferences, and active preferred zones before stamping
  `onboarding_completed_at`.
- Direct authenticated writes cannot change account status, consent audit
  fields, onboarding completion, internal rating, or rated-match count.
- `request_account_deletion` is retry-safe and changes the account to
  `deletion_requested`; M1 does not hard-delete operational history.
- A player is marketplace-eligible only when active, adult-confirmed, fully
  onboarded, and otherwise eligible for the feature-specific action. UI route
  guards are convenience only; later match/discovery RPCs must repeat this
  database-side check.

## Important invariants

- A user participates at most once per match.
- Singles cannot exceed 2 accepted participants; doubles cannot exceed 4.
- One vote exists per player per time option.
- One active booking request exists per match.
- Accepted court bookings cannot overlap.
- A booking allows at most one club-proposed alternative; after that the requester must accept, reject, or cancel rather than receive a further counter-alternative.
- One result workflow exists per match.
- One rating event per player per finalized result.
- Suspended/deleted users cannot create or join public matches. Suspension does not retroactively remove a user from matches/bookings already in progress; it blocks new public activity going forward, cancels their own pending unaccepted booking requests, and leaves existing chat history visible to remaining participants. Full cascade behavior is an operations decision to confirm before Milestone 8.
- Chat authors must be active participants at the time of insertion.

## Rating v1

Start with an internal Elo-like number centered at 1200 and a displayed skill band. Keep the exact update function behind a database function with parameters in configuration, not UI code. Mark players provisional until at least five confirmed results. Do not market the number as an official ranking.

Suggested first implementation:

- singles only affects rating in v1;
- expected-score Elo update with configurable K factor;
- winner/loser outcome only, with retirement handled through an explicit operations rule;
- doubles results recorded but not rated until a defensible team-rating rule is tested.

## Migration discipline

- Never edit an applied migration in shared environments.
- Every new table starts with RLS enabled.
- Add indexes based on actual query patterns.
- Test policies as anonymous, player A, player B, club staff, club admin, and platform admin.
- Generate TypeScript database types after migrations and commit them.
