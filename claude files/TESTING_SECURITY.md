# Testing, Security, and Release Gates

## Test pyramid

### Unit tests

Cover pure domain rules:

- match capacity and eligibility
- valid state transitions
- time agreement
- cancellation classification
- rating calculation
- localization/date formatting
- notification deduplication keys

### Database tests

Use local Supabase and test each policy/constraint as multiple identities:

- anonymous
- owner/player A
- unrelated player B
- blocked player
- club staff for assigned club
- club staff for another club
- club admin
- platform admin
- suspended user

Test races for final match spot, booking acceptance, time selection, and result finalization.

### Component/integration tests

Cover validation, loading/empty/error/offline states, next-action rendering, protected navigation, deep links, and optimistic rollback.

### End-to-end smoke flows

Automate at minimum:

1. Sign in and complete onboarding.
2. Create a singles match; second user joins and votes.
3. Club accepts booking; both players see confirmation.
4. Submit and confirm a result; rating changes once.
5. Block/report a user; discovery and chat access change correctly.

## Security requirements

- RLS enabled on every table exposed through Supabase APIs.
- Mobile/browser uses only publishable client credentials.
- Secret/service credentials remain server-side and are rotated through the provider.
- Authorization is tested independently of UI visibility.
- Rate-limit authentication, invitations, chat, reports, and expensive discovery queries. Starting values, adjustable in configuration: 5 auth attempts per 15 minutes per identifier, 20 invitations per user per day, 1 report per user per target per day, 60 chat messages per user per match per hour, 30 discovery queries per user per minute. Treat these as defaults to tune during the pilot, not fixed requirements.
- Validate and normalize all user input; restrict upload types and sizes.
- Use signed or access-controlled media URLs for private assets.
- Prevent open redirects and validate deep-link destinations.
- Invite tokens are random, opaque, expiring, revocable, and stored hashed where practical.
- Audit privileged actions without copying sensitive row contents.
- Apply dependency scanning and secret scanning in CI.
- Define retention/deletion behavior for chat, reports, audit logs, and deleted accounts before release.

## Privacy requirements

- Collect the minimum data needed for matching and safety.
- Use coarse zones; do not store live location for the MVP.
- Do not expose phone/email between users.
- Provide consent/version records for terms, privacy, and community rules.
- Provide account-deletion request and support contact.
- Analytics and crash reports must scrub contact data, chat, notes, tokens, and exact locations.
- If juniors are included, stop development of junior onboarding until guardian consent, communication restrictions, and safeguarding rules are approved.
- Reference applicable Lebanese data protection law for the pilot; where no directly-applicable statute covers a practice, follow a GDPR-equivalent baseline voluntarily (minimization, purpose limitation, deletion on request). Confirm with legal counsel before public release, not before the pilot.
- Default retention absent a founder override: match chat and audit events retain for the life of the account plus 12 months after deletion request, then hard-delete; reports/disputes retain for 24 months for safety-history purposes. Revisit before Milestone 6 implements chat storage.

## Accessibility checks

- Screen-reader labels and logical reading order
- Touch targets at least platform-recommended size
- Dynamic font scaling without clipped primary actions
- Color is not the only status indicator
- Keyboard navigation for the dashboard
- Visible focus and usable errors
- Arabic RTL layout test on every critical flow

## Pre-release gate

Do not release if any item fails:

- lint, typecheck, unit, database, integration, and smoke tests pass
- no critical/high unresolved security finding
- RLS matrix passes in staging
- backup and restore have been rehearsed
- crash reporting and alert ownership work
- privacy policy, terms, community rules, and deletion/support path exist
- club booking/cancellation process is documented
- app handles revoked session, offline launch, expired invite, and push-disabled device
- no production secrets or personal test data exist in the repository
- operational owner can resolve booking and result disputes without direct database editing
