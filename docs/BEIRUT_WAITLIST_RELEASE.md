# Beirut waitlist implementation — 30 September 2026

Branch: `beirut-landing-page`, rebuilt on `staging` on 2 October 2026 from the never-pushed local `landing-page` branch and its stash. The migrations were renumbered from 111 and 112 to 114 and 115 because staging already had 113; neither had been applied to a hosted project.

## Implemented

- `/beirut` rewrites to the built landing HTML. Hero URLs are root-relative, so images work with both URL forms.
- Clear first-group invitation timing, “Free to join”, warmer community copy and a consistent “Get my invite” action.
- Two-step signup retains one contact method, consent, optional area and the compact multi-select availability matrix. Level descriptions now describe ability; narrow-screen spacing is tighter.
- The success screen enables optional WhatsApp sharing to `https://racketbound.com/beirut`. No messages are sent automatically.
- Analytics hooks are literal no-ops. Privacy links open the full notice directly in live mode.
- The privacy notice is rendered as headings, paragraphs and lists. `NEXT_PUBLIC_SUPPORT_EMAIL` is set to the support inbox (DECISIONS 2026-08-30) in the local dashboard environment with the owner's approval. Set the same variable on the deployment before building; local ignored env files are not deployed. Inbox delivery was not tested.
- The server refuses signup while the support contact is the `.invalid` placeholder or the service-role key is missing.
- The API uses bounded, server-side HTTP calls to Supabase. This avoids an observed Node 20/WebSocket incompatibility in the installed realtime SDK. Service credentials never enter landing HTML.
- Migration 115 adds an atomic rate-limit RPC (eight accepted attempts per hashed address per rolling hour), Retry-After support, explicit service-role privileges and hourly cleanup of attempts older than 24 hours. Migration 114 (the table and operator RPC) was not rewritten.
- Failed submissions retain the form. Changed payloads after a failed request receive a fresh idempotency key; unchanged retries retain theirs. Duplicate contact responses remain `{ok:true}` without disclosing contact membership.
- Operator errors no longer also display the misleading empty-list message.

## Verification

- Full local database suite (30 September, before renumbering): 85 files, 383 assertions passed, including the tests now numbered 114 and 115.
- Domain tests: 9 passed. API unit tests: 10 passed.
- Local API integration: one row persisted, duplicate generic success, operator RPC sees it, auth-user and profile counts unchanged. Uses only localhost Supabase and disposable test data.
- Concurrent database test: 16 simultaneous requests, exactly 8 allowed and 8 limited.
- Dashboard TypeScript check, changed-file ESLint, inline JavaScript syntax check and production build passed.
- Build has a nonfatal existing legal-file tracing warning and a Node 20 deprecation warning from other Supabase usages. These are not presented as fixed globally.
- Browser: actual dashboard `/beirut` works; privacy renders and shows the approved contact. Checked 390px and 320px signup, required-field messages, back/continue selection preservation, local demo completion and no horizontal overflow. Physical-phone keyboard behavior and hosted HTTPS submission remain release checks.
- Local cron job `beirut_prune_signup_attempts` is active at `17 * * * *`.

Local Supabase was already running. Its pending migrations 109–112 (the waitlist ones, then numbered 111 and 112) were applied locally. No hosted migration, deployment, invite sending or account-claim feature was performed. The unrelated `.claude/launch.json` changes were preserved.

## Repeat the checks

From repository root with the repository's installed toolchain:

```sh
python apps/landing/build.py
node --check apps/landing/syntax-check.js
pnpm exec vitest run packages/domain/src/prelaunch-signup.test.ts
pnpm exec vitest run --config apps/dashboard/vitest.prelaunch.config.ts
pnpm db:test
python scripts/test-prelaunch-concurrency.py
pnpm exec vitest run --config apps/dashboard/vitest.prelaunch-integration.config.ts
pnpm --filter dashboard typecheck
pnpm --filter dashboard build
```

The integration test is opt-in (`route.integration.ts`) and expects seeded local Supabase and Docker. It refuses a non-loopback Supabase URL. The concurrency script also targets the named local Docker container only.

## Deployment remains

1. Confirm the intended hosted project and inspect `supabase migration list` and `supabase db push --dry-run`. Staging was at 001→110, 113 on 2 October 2026, so the dry run should list only 114 and 115.
2. Apply reviewed migrations with `supabase db push`, preferably staging first. Do not use MCP apply_migration, and do not renumber a migration once it has been applied anywhere.
3. Confirm the hourly cleanup job is active. If pg_cron is unavailable, configure an equivalent hourly job before accepting signups. Review notice wording against actual deployment/retention practice; formatting this notice is not legal approval.
4. Set `NEXT_PUBLIC_SUPPORT_EMAIL` to the support inbox before building, keep `SUPABASE_SERVICE_ROLE_KEY` server-only, rebuild the landing output after template changes, and deploy the dashboard over HTTPS. The front-end intentionally remains a non-saving demo over HTTP.
5. The current IP-header assumption is Vercel-managed ingress: Vercel documents that it overwrites forwarded addresses to prevent spoofing. If deploying behind a different proxy, configure it to strip untrusted incoming forwarding headers before relying on this limiter. [Vercel request headers](https://vercel.com/docs/headers/request-headers).
6. Verify the canonical domain and sharing URL. Complete a controlled HTTPS signup, see it in `/admin/prelaunch`, repeat it and confirm a single row, no auth user/profile, readable privacy and preserved details on failure.
7. Operators handle correction/removal emails manually; no self-service deletion or invitation-sending workflow was added. When the prelaunch list closes, operators must remove its entries as stated in the notice.
