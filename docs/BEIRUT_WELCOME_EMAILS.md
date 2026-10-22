# Beirut welcome emails

Implemented 22 October 2026. Email only, as requested by the owner. Sending is off by default.

## Behavior

A completed v3 email signup queues one welcome when PRELAUNCH_WELCOME_ENABLED=true. The signup transaction includes the queue state, and Next.js after() tries delivery after the successful HTTP response. A protected worker recovers crashes and temporary provider failures. Duplicate submissions still return {ok:true}, without scheduling another message. Existing entries, older open v1/v2 forms, and WhatsApp entries receive no automatic welcome. No accounts or profiles are created.

The email confirms receipt and explains that app access comes later. It contains a reply address and the privacy URL. It is plain text with no remote images or tracking pixels. Disable open and click tracking on the Resend sending domain as well. Resend acceptance is recorded as accepted, not delivered: inbox delivery and bounces must be checked in Resend.

## Enable production

1. Apply migration 118 with the repository's Supabase CLI db push process. Do not use MCP apply_migration. The migration adds delivery fields, protected RPCs and a five-minute cron job. It does not send messages or backfill old entries.
2. In the existing Vercel dashboard project, add production-only server variables: RESEND_API_KEY (a sending key for the verified domain), PRELAUNCH_WELCOME_FROM (the verified sender email, for example support@racketbound.com after confirming it), and PRELAUNCH_WELCOME_TOKEN (a fresh random secret of at least 32 characters). Keep all secrets out of NEXT_PUBLIC_* and out of Git. Supabase Auth's SMTP settings are separate and do not automatically provide a key to Vercel.
3. Store the identical dedicated token in Supabase Vault under prelaunch_welcome_token. The scheduler calls only https://racketbound.com/api/internal/prelaunch-welcome. Do not reuse a service-role key. Check cron.job for beirut_welcome_email and verify successful worker responses. The worker returns 401 without the token and 503 while delivery is unconfigured.
4. Set PRELAUNCH_WELCOME_ENABLED=true only on production and deploy the dashboard and landing together. Confirm NEXT_PUBLIC_SUPPORT_EMAIL is a monitored inbox. Keep previews disabled; production credentials must not be copied to preview deployments.
5. Submit one controlled signup using an email you own, verify the actual received email, and submit it again to confirm there is no second welcome. Inspect Resend for acceptance, inbox/spam for delivery, and the database status below. This live test has not been performed by this implementation.

## Failure recovery and retention

The worker claims one job per invocation using a five-minute lease and row locking. Most messages are attempted immediately; the cron job handles missed or failed attempts. Transient failures retry after ten minutes, at most three attempts. A UUID-based Resend idempotency key is reused, and retries stop after 23 hours from the first attempt (inside Resend's 24-hour window). Jobs older than 24 hours and withdrawn entries are stopped. Terminal failures require operator review; do not reset an ambiguous accepted/timeout job and send again after the provider's deduplication window.

View operational counts in the Supabase SQL editor:

```sql
select welcome_status, welcome_failure_code, count(*)
from public.prelaunch_signups
group by welcome_status, welcome_failure_code;
```

Delivery fields live on the waitlist row and disappear with its existing 12-month cleanup or manual removal. Provider delivery logs have their own retention settings. Neither message bodies nor contacts are logged by the worker. A delete/withdrawal that races a provider request already in flight cannot retract that email.

To stop dispatch immediately, set PRELAUNCH_WELCOME_ENABLED=false and redeploy. Do not change sender/copy/support settings during an active retry window without reviewing pending jobs: Resend requires identical payloads for the same idempotency key.

## Validation and remaining activation work

The repository includes tests for duplicate submits, channel/consent gating, worker authorization, provider failures, stale leases, retry limits and database permissions. Production activation requires the verified Resend sender/key, the scheduler token in Vercel and Vault, migration 118, and a controlled delivery test. No old signup has been emailed by this implementation.
