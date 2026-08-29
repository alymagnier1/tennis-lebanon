# Phase 1 — staging setup runbook

**Date:** 2026-08-29
**Covers:** `PILOT_50_PLAYER_LAUNCH.md` Phase 1, plus the parts of Phase 5 that can be done before there is a build.

Phase 0 is closed on everything a local machine can prove. This is the command-level order for standing up hosted staging, written to be worked through while account approvals land.

---

## Start these first — they are the critical path

None of them need code, all of them take days, and every phase after this one blocks on at least one:

| Account                 | Why it blocks                                                                                          | Watch for                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase**            | Everything in this document                                                                            | Frankfurt `eu-central-1` per `ARCHITECTURE.md`                                                                                                                                                                              |
| **Expo / EAS**          | The project id, without which `getExpoPushTokenAsync` cannot be called at all — no push, on any device | —                                                                                                                                                                                                                           |
| **Apple Developer**     | TestFlight                                                                                             | Enrolment is not instant                                                                                                                                                                                                    |
| **Google Play Console** | Play internal testing                                                                                  | **A personal developer account must run a closed test with 12+ testers for 14 continuous days before it can apply for production access.** An organisation account is exempt. Confirm which you have before planning a date |
| **Transactional email** | Step 8 below, and it is a hard blocker                                                                 | Resend, Postmark or SES                                                                                                                                                                                                     |

Start all five today. Then work down this list.

---

## 1. Create the staging project

Frankfurt (`eu-central-1`). Record the project ref. Keep it separate from any future production project — `STAGING_CHECKLIST.md` §2 treats a shared project as a promotion failure.

## 2. Link the CLI

```bash
supabase link --project-ref <staging-ref>
```

## 3. Push the schema

```bash
supabase db push
```

All 94 migrations, in order, no errors. This creates the schema and nothing else: no zones, no clubs, no accounts.

## 4. Do not run `seed.sql`

Not a step — a prohibition, and the one most likely to be broken by muscle memory. `pnpm db:reset` is a local command. Seeded `@tennis-lebanon.test` accounts and the `Pilot North/Central/South` fixtures must never exist on a hosted project.

## 5. Insert the real zone

```bash
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/pilot/beirut-zones.sql
```

Idempotent — the unique constraint on `(country_code, city_code, slug)` makes a second run a no-op. Its final query must report **exactly one active zone**. If it reports four, you ran the seed.

## 6. Create yourself as platform operator

Sign up through the app first so `auth.users` has your row, then:

```sql
insert into public.platform_roles (user_id, role)
values ('<your-auth-uid>', 'admin');
```

Without this, `/admin/reports` and `/admin/disputes` are closed to everyone, and `list_open_user_reports` refuses every caller with `42501`. Workflow 4 proved that refusal works; this is what makes it stop applying to you.

## 7. Configure the auth redirect

Add `tennislebanon://auth/callback` under **Auth → URL configuration**. The magic link is the front door; if this is missing, every sign-in dead-ends in a browser.

## 8. Configure custom SMTP — **mandatory, not optional**

Supabase's built-in sender is rate-limited to a handful of messages an hour and is not intended for production. This project's own `config.toml` sets `email_sent = 2` locally, which is the same shape of limit.

Sign-in is a magic link ([`sign-in.tsx`](<../apps/mobile/app/(public)/sign-in.tsx>) calls `signInWithOtp`), so **email delivery is the whole front door**. At 50 testers on the built-in sender, most of them never get in.

Configure a real provider, then send yourself a magic link and open it on a phone. Not "the API returned 200" — a link that arrives and works.

## 9. Create the notification Vault secrets

Migration `060` already built the invoker: `invoke_process_notifications` posts to the Edge Function and `pg_cron` runs it every five minutes. It is a deliberate no-op until these two secrets exist, which is why applying the migration to an unconfigured project is safe.

```sql
select vault.create_secret(
  'https://<staging-ref>.supabase.co/functions/v1/process-notifications',
  'process_notifications_url',
  'Edge Function endpoint invoked by tennis_process_notifications'
);
select vault.create_secret(
  '<service-role-key>',
  'process_notifications_token',
  'Service role key used to authenticate the notification sender'
);
```

Until both exist, every reminder, invite and cancellation is written to the outbox and never sent — silently, with no error anywhere.

## 10. Deploy the Edge Function

```bash
supabase functions deploy process-notifications
```

## 11. Regenerate types if the schema moved

```bash
pnpm db:types
```

Commit the result if it changes.

## 12. Backup drill

Follow [`BACKUP_RESTORE.md`](BACKUP_RESTORE.md) and record the date in the launch doc's sign-off table. `STAGING_CHECKLIST.md` §3 wants one inside the last 30 days.

---

## Environment variables

| Variable                                                          | Staging value                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `EXPO_PUBLIC_APP_ENV` / `NEXT_PUBLIC_APP_ENV`                     | `staging`                                                        |
| `EXPO_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`           | `https://<ref>.supabase.co`                                      |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key                                                 |
| `EXPO_PUBLIC_SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL`         | A real monitored inbox                                           |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL`                                   | `tennislebanon://auth/callback`                                  |
| `EAS_PROJECT_ID`                                                  | From `eas init`                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`                                       | Dashboard server only — a Vercel secret, never in a mobile build |

`packages/config/src/env.ts` throws at startup if `SUPPORT_EMAIL` ends in `.invalid` while `APP_ENV` is not `local`. A staging build will refuse to boot rather than ship a placeholder, so this is enforced rather than remembered.

---

## What Phase 1 cannot prove

Worth stating, so nobody reads a green Phase 1 as more than it is:

- **Push on a real device.** Needs the EAS project id and store credentials — Phase 4. Finding 4 in `COHORT_A_REHEARSAL_FINDINGS.md` is parked on exactly this.
- **Arabic RTL on a physical screen.** Arabic ships in cohort 1 and switching locale calls `forceRTL`, which reloads the app. Nobody has walked it on a device. Phase 7.7.
- **Magic links reaching Lebanese inboxes.** Step 8 gets a provider configured; only real testers on real networks prove deliverability.

These three are the reason local rehearsal has reached its limit, and the reason the account clock above matters more than any remaining code change.
