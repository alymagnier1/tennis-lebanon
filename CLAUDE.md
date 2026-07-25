# CLAUDE.md

## Mission

Build a production-minded but deliberately lean tennis mobile application for Lebanon. The core outcome is a completed match:

`compatible player → agreed time → accepted court booking → played match`

Prioritize reliability, privacy, simple club operations, and fast iteration. This is not a generic social network and not a full club-management suite.

## Source of truth

Before planning or coding, read:

- `docs/PRD.md`
- `docs/FLOWS_AND_SCREENS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/ROADMAP.md`
- `docs/TESTING_SECURITY.md`

If documents conflict, use this precedence:

1. Explicit instruction from the human in the current session
2. `docs/PRD.md`
3. Database migration and `docs/DATABASE.md`
4. `docs/ARCHITECTURE.md`
5. `docs/FLOWS_AND_SCREENS.md`
6. `docs/ROADMAP.md`
7. `docs/TESTING_SECURITY.md`

Supplementary design docs (`docs/DISCOVERY.md`, `docs/LIFECYCLE.md`) extend the above for their topics; if they conflict with items 1–7, the numbered list wins.

Record material decisions in `docs/DECISIONS.md` with date, decision, alternatives, and consequence.

## Required working method

For every milestone:

1. Restate the milestone and list assumptions.
2. Inspect existing code before proposing changes.
3. Present a short file-level plan.
4. Implement the smallest vertical slice that satisfies the acceptance criteria.
5. Add or update tests in the same change.
6. Run formatting, linting, type checking, relevant tests, and database checks.
7. Report changed files, verification performed, unresolved risks, and the next milestone.

Do not silently expand scope. Ask before changing product rules, the main stack, authentication method, minors policy, or booking semantics.

## Engineering rules

- TypeScript strict mode everywhere. Avoid `any`; explain unavoidable exceptions.
- Prefer shared Zod schemas and generated Supabase database types.
- Keep business logic outside screen components.
- Use server-side or database functions for privileged actions and rating updates.
- Never ship a Supabase secret/service key in mobile or browser code.
- Enable and test Row Level Security on every exposed table.
- Treat client checks as UX only; authorization must be enforced in the database/server.
- Use UTC timestamps in storage and `Asia/Beirut` only for display/default scheduling.
- Store money as integer minor units with an explicit currency, even though v1 does not collect payments.
- Use UUID primary keys and database constraints for invariants.
- Use idempotency keys or unique constraints for retryable mutations.
- Do not log message bodies, phone numbers, emails, precise location, tokens, or secrets.
- Use soft state transitions and audit events for bookings, attendance, disputes, and moderation. Avoid destructive deletion of operational records.
- Accessibility: labelled controls, sensible focus order, dynamic type, minimum touch targets, and adequate contrast.
- Localization: no hard-coded user-facing copy inside business components. Support English, Arabic RTL, and French structure from the start.

## Product constraints

MVP includes:

- account and verified contact method
- player profile and provisional skill level
- availability and zone preferences
- player discovery
- create/join/invite for singles and doubles
- proposed time slots and participant voting
- club/court directory
- booking request and manual club approval
- match hub, participant chat, reminders, and sharing
- attendance/no-show tracking
- mutually confirmed result and simple rating update
- club dashboard
- platform moderation tools

MVP excludes:

- in-app payments or stored cards
- coaches and lesson booking
- tournaments, leagues, and ladders
- AI or video stroke analysis
- social feed
- equipment marketplace
- advertisements
- wearable integrations
- other sports

Do not implement excluded features unless the human explicitly changes scope.

## UX principles

- The primary action is always obvious: find, create, join, vote, book, confirm, or play.
- Show public players by practical area/zone, never home address or exact live location.
- Do not expose direct contact details. Offer WhatsApp sharing through a user-initiated share sheet, not by revealing phone numbers.
- Display a clear status and next action on every match and booking.
- Empty states must explain how to create liquidity, such as widening time, level, or zone filters.
- Do not show a precise numeric rating until the player passes the provisional-match threshold defined in `docs/DATABASE.md` (Rating v1); display a provisional label first.
- Reliability must be factual and explainable. Never create a public “shame score.”

## Branch and commit discipline

- One milestone or cohesive vertical slice per branch.
- Make small commits with imperative messages.
- Do not mix large refactors with new behavior.
- Never rewrite migration files that have been applied to a shared environment; add a new migration.
- Do not commit `.env`, credentials, signing files, production data, or generated build artifacts.

## Completion gate

A feature is incomplete until:

- its acceptance criteria pass;
- authorization and RLS are covered;
- loading, empty, offline/error, and retry states are handled;
- analytics events contain no sensitive data;
- accessibility labels exist;
- English copy is externalized for localization;
- tests and documentation are updated;
- any material decision made along the way is recorded in `docs/DECISIONS.md`.
