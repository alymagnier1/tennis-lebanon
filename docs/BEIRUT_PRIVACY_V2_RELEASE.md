# Beirut privacy notice v2 — 10 October 2026

Approved by the owner: name Ali Moghnieh as responsible; retain waitlist entries for 12 months after signup. The same maximum applies to waiting, invited and claimed waitlist rows; app accounts are separate. Explicit removal requests and closing the list require earlier deletion.

The notice now explains completed-form collection, invitation use, private visibility, delivery providers, hashed-IP abuse protection, and how WhatsApp signups can request removal by email. No tracking or account creation was added. Existing v1 forms remain accepted and retain their v1 consent label; new forms send v2. The previous notice is archived under docs/legal/archive.

Before publishing:

1. Migration 116 was applied by the owner. Apply the follow-up migration 117 with the repository's normal `supabase db push` process. Migration 117 replaces the three-month rule with 12 months; it keeps the existing hourly `beirut_prune_signups` schedule created by 116. It deletes expired waitlist rows only, never linked profiles. Review aged entries before enabling this scheduled deletion; it applies to existing entries too.
2. Verify that `beirut_prune_signups` and `beirut_prune_signup_attempts` are active and their runs succeed. The notice allows up to one hour after the 12-month expiry for cleanup, and normally up to 25 hours for abuse-prevention records.
3. Deploy the dashboard and rebuilt landing page together. The notice, domain current version and form payload must all use `beirut-prelaunch-v2`.
4. Confirm the configured support inbox receives removal requests. Remove entries from any operator CSV exports as well as the database when honoring a request, expiry or closing the list. Verify provider backup retention separately; the application cleanup covers the live database.

Deployment update, 10 October 2026: migration 117 was applied to hosted Supabase project rvdzalxavpcijbiikkjz. A subsequent db push --dry-run confirmed the remote database is up to date. No invitations were sent or accounts created. Website publication follows through the staging branch and its Vercel production integration.

The owner revised retention from three to 12 months before v2 was published. The notice therefore remains v2. Migration 116 is immutable; 117 is the correction. Existing expiry dates are calculated from the original signup date, not from the migration date. Previously deleted entries are not restored.
