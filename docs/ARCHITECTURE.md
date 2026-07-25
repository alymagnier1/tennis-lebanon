# Technical Architecture

## System shape

Use a TypeScript monorepo:

```text
apps/
  mobile/        Expo application for players
  dashboard/     Next.js App Router for club and platform staff
packages/
  api/           typed query/mutation wrappers
  config/        lint, TypeScript, environment validation
  domain/        pure business rules and state machines
  i18n/          English, Arabic, French resources
  types/         generated DB types and shared public types
  ui/            design tokens and shareable primitives where practical
supabase/
  migrations/
  functions/
  seed.sql
docs/
```

Avoid sharing React components between mobile and web unless the benefit is obvious. Share domain rules, schemas, types, and tokens.

## Mobile application

- Expo Router with protected route groups for authenticated/onboarded states.
- TanStack Query owns server state, caching, invalidation, retries, and offline-aware UX.
- React Hook Form + Zod for form state and validation.
- SecureStore for session-adjacent device secrets where required; never put secret backend keys in the app.
- Expo Notifications for push tokens and deep links.
- Realtime only for active match chat and high-value status changes. Standard queries remain the source of truth.

Suggested route groups:

```text
src/app/
  (public)/
  (auth)/
  (onboarding)/
  (tabs)/
  match/[id].tsx
  booking/[id].tsx
  modal/
```

### Authentication and onboarding

- Supabase Auth uses email magic links only. The mobile callback is
  `tennislebanon://auth/callback`; callback parsing accepts only that exact
  scheme/host/path and never logs tokens or email addresses.
- The mobile client persists the Supabase session through Expo SecureStore
  (browser local storage is development-only), refreshes while active, and
  treats revoked sessions as signed out.
- The root gate resolves explicit anonymous, onboarding, ready, suspended, and
  deletion-requested states. Every route group repeats its authorization check
  so a direct deep link cannot reveal a protected screen during session restore.
- Onboarding progress is encrypted on the device. Completion is server-authoritative
  and atomic through `complete_onboarding`; the client cannot set consent
  timestamps, account state, completion state, or rating fields directly.
- Availability setup remains Milestone 2. Milestone 1 captures preferred zones
  because they are part of the required E1 profile.

## Zones (minimum shape)

`zones` must at least carry: `id`, `name`, `city`, `country`, a coarse center point (or polygon if/when needed), and an `active` flag. Discovery, analytics properties, and club coverage all reference `zone_id`; do not key any of these off freeform text. Add country/city here before adding a second launch geography, not as a later migration.

## Dashboard

- Next.js App Router.
- Server Components for initial data where useful; Client Components for queue interactions and calendars.
- Supabase server client with user session; authorization remains in RLS/database.
- Server-only secret keys, if truly necessary, are limited to audited admin operations.
- Do not expose a generic SQL/admin endpoint.
- Club-staff and club-admin authorization is checked against `club_memberships` on every request via RLS, not cached in the session/JWT. A revoked membership takes effect on the staff member's next request, with no separate invalidation step needed.

## Backend responsibilities

Use direct Supabase client operations for ordinary RLS-protected CRUD. Use Postgres functions or Edge Functions for operations requiring atomic multi-table changes or privileged side effects:

- accept/decline join request when capacity may race
- select agreed time
- accept booking while preventing overlap
- send invitation/reminder notification jobs
- finalize confirmed result and apply rating update idempotently
- suspend account or resolve dispute with an audit event

## State machines

### Match

`draft → open → full → ready_to_book → booking_pending → confirmed → in_progress → completed`

Side exits: `cancelled`, `expired`, `disputed`.

Do not infer state only from UI. Store status and validate allowed transitions in the database/domain layer.

### Booking

`requested → accepted | rejected | alternative_proposed → accepted | rejected | cancelled`

An accepted booking may later become `completed` or `cancelled`.

### Result

`submitted → confirmed | disputed → resolved`

Only `confirmed` or admin-resolved results can produce a rating event.

## Environment strategy

- Local Supabase for development and tests.
- Separate hosted staging and production projects.
- **Hosting region:** Supabase has no Middle East primary region. Default staging and production to **Central EU (Frankfurt, `eu-central-1`)** as the lowest-latency option for Lebanese users; measure P95 read latency from Beirut on pilot devices before locking production, and revisit if Supabase adds a closer region or read replicas become cost-effective.
- Separate Expo application identifiers and dashboard deployments.
- Environment variables validated at startup with a committed `.env.example`.
- Production migrations run from CI after backup/checkpoint procedures are defined.

## Notifications

Store device tokens per user/device. A notification job contains type, recipient, entity ID, scheduled time, deduplication key, and state. A server worker/function sends the notification and records provider response without storing sensitive message content.

Failed sends retry with backoff up to a small fixed cap (e.g. 3 attempts), then move to a dead-letter/failed state visible in `/admin/jobs` rather than retrying indefinitely. Deduplication key prevents duplicate sends across retries.

**v1 channel:** Expo push only. Match-invite sharing may use the OS share sheet (including WhatsApp) without exposing phone numbers; that is not the same as outbound transactional notifications.

**Open decision:** WhatsApp Business API for reminders and booking-status updates (see README founder-decision list). Push opt-in is often low in Lebanon; if adopted, extend the job model with a channel field and provider template IDs without logging message bodies.

Initial events (push in v1):

- invitation received
- join request received/approved/rejected
- time vote needed / time agreed
- booking accepted/rejected/alternative
- upcoming match reminder
- attendance requested
- result confirmation requested/disputed
- safety/support update

## Analytics events

Use stable, non-sensitive event names:

- `onboarding_completed`
- `discovery_search_performed`
- `match_created`
- `match_joined`
- `match_filled`
- `time_agreed`
- `booking_requested`
- `booking_accepted`
- `match_completed`
- `match_cancelled`
- `report_submitted`

Properties may include coarse zone ID, match format, skill band, and elapsed durations. Never send names, contact details, chat, exact coordinates, free text, or invite tokens.

## International expansion hooks

Create country/city configuration for:

- timezone
- supported languages
- currencies
- payment provider (future)
- booking/cancellation rules
- adult/minor age policy
- rating display rules
- distance units

Do not fork the product per country.
