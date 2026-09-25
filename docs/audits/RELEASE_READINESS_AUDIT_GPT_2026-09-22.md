# Release readiness audit (GPT) — pre 2026-09-22

**Verdict as given: NOT DONE (4/10).** "The app is not ready to promote beyond a tightly controlled cohort-1 rehearsal. The core product direction is sound, but release evidence and the acquisition loop have material gaps."

Author: GPT, via chat. Recorded here 2026-09-25 so it survives the conversation, per [`CHAT_AUDITS_INDEX.md`](../CHAT_AUDITS_INDEX.md).

**Dating.** The audit cites `e2e/maestro/m1-auth-onboarding.yaml`, which `839a108` deleted on 2026-09-22, and reports Maestro using `com.tennislebanon.dev`, which the same commit changed. So it was run **before 2026-09-22** and is at least three days and ~60 commits stale as recorded.

The findings are reproduced as written. The **Status** column is a later verification pass and is not the auditor's — a dated snapshot, last reconciled **2026-09-25 (evening)**. The latest review, and the release truth, is [`CLAUDE_IMPLEMENTATION_ASSESSMENT_2026-09-25.md`](CLAUDE_IMPLEMENTATION_ASSESSMENT_2026-09-25.md) plus `docs/STAGING_CHECKLIST.md`; where they differ, they win.

**Where it stands:** of the auditor's five-point fix list, 2 are done (domain + invite page, RLS suite), 1 is implemented and waiting to reach phones (conflict warning), 1 is partly done (E2E: loop flows written, never run), and 1 is open (the two-phone rehearsal with a received push). Nothing left on this list is code; what remains is phones, the rehearsal and the phase-2 key retirement.

---

## Findings

| P   | Finding                                          | Status (reconciled 2026-09-25)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0  | Local RLS/RPC test suite fails (`104` missing)   | **Done.** Local branch-switch drift, not a code bug. Clean `pnpm db:reset` (001→108) then `pnpm db:test`: **81 files / 351 tests**. Staging is 001→108, applied in order with `supabase db push`.                                                                                                                                                                                                                                                                                                                           |
| P0  | Shared invites cannot acquire new players        | **Web live; app build ready, not yet on a phone.** `https://racketbound.com/invite#<token>` is live (static, no match details, token never sent to the server); a signed-out invitee returns to the invite after onboarding. Three invite defects found by the 2026-09-25 review — blocked players could read details, shared-link Decline failed, Accept offered to the wrong level — fixed in `107`/`108` and live on staging. EAS build `168b2257…` carries the https links. **Left:** install and test on a real phone. |
| P0  | Dashboard is not a reliable staging surface      | **Done.** It was never a 500: the domain had no A record. Now HTTPS on `racketbound.com`, `www` → apex, and Vercel production tracks `staging` (it had been frozen at 2026-09-12 on `pilot-handover`). **Left:** a human sign-in on the domain.                                                                                                                                                                                                                                                                             |
| P1  | Push delivery remains unproven                   | **Server side done; device side open.** The sender had answered every cron call 401 since setup; it now uses a dedicated invoker token and the `sb_secret` key (function v4, 200s). FCM V1 credential confirmed in EAS. Registration failures report to Sentry. **Left:** `device_push_tokens` is still 0 — install the new build, enable notifications in Profile, receive one push.                                                                                                                                       |
| P1  | E2E smoke tests are stale and shallow            | **Partly done.** Package fixed; sign-in current; stable `testID`s on the loop's controls; the core loop (publish → join → court confirmed) written as `e2e/maestro/loop/`. **Left:** never executed — Maestro is not installed where it was written and the flows need testers' credentials; Google sign-in, invite links, push and results stay in the manual rehearsal.                                                                                                                                                   |
| P1  | Pilot gate is red (Prettier on `.cursor/skills`) | **Committed code is green.** Every red seen was working-tree line endings rewritten by a local tool, cleared by `pnpm format`. Optional: gate on committed content.                                                                                                                                                                                                                                                                                                                                                         |
| P2  | Creation does not warn about schedule conflicts  | **Implemented (`9d3b54c`).** Advisory banner under the time picker with the clashing match and a link; publishing is never blocked. Along the way, a late slot (e.g. 11:30 PM) ended before it started on four screens — fixed with `slotWindowUtc`. JS-only, so it reaches installed builds as an EAS update.                                                                                                                                                                                                              |
| P2  | French quality is incomplete                     | **Done in code (`1f09f0f`).** 51 genuinely English strings translated; cognates and placeholders left on purpose. **Left:** a native speaker's read.                                                                                                                                                                                                                                                                                                                                                                        |

## Security posture (as given)

Good foundations: Supabase session storage uses SecureStore on native; auth callbacks allow only the intended schemes; Sentry disables default PII collection; privileged database functions are explicitly revoked from public roles. The exposed Supabase anonymous key in the EAS config is expected client configuration, not a service-role secret.

Explicitly **not** marked complete: the authorization suite was failing from migration drift, and hosted staging could not be inspected directly. No confirmed critical or high source-level vulnerability was found in the reviewed code, "but that is not a substitute for a clean RLS matrix on the rebuilt local database and staging spot checks."

**Status (2026-09-25):** both conditions are met — the RLS/RPC suite is green on a rebuilt database, and staging grants were spot-checked. **Open incident:** the staging `service_role` key appeared in a chat screenshot on 2026-09-22 and **remains valid**. Supabase no longer allows rotating legacy keys, so the remedy is to retire them: phase 1 is done (dashboard and build on the publishable key, sender on `sb_secret`, service key out of Vault and Vercel); phase 2 — deactivate the legacy keys, migrate signing keys, rotate, wait the token lifetime plus 15 minutes, revoke — is pending in `docs/STAGING_CHECKLIST.md` §7d.

## Product and retention (as given)

- **Activation bottleneck** is getting a compatible player. Discovery, availability, instrumentation and rematch exist, but the invite loop cannot bring in non-users.
- **Retention loop** — completed match → celebration/rematch → next match — is the right loop. The rematch card is strongest because it appears after real value was received.
- **Measurement** exists for onboarding-step, create-abandonment, discovery-empty-state, liquidity and rematch. Treat create abandonment as a **lower bound**: app termination emits nothing.
- **Prompt quality** — the court WhatsApp handoff records "opened", then asks the host whether it was sent. Sensible for cohort 1, but notification delivery must be verified before reminders become part of the promise.

## Design review (as given)

**The One Thing:** turn "I want to play tennis" into a completed match.

**Keeps its promise?** Partly. Existing users can coordinate a match, choose a court, and confirm it. A new invitee cannot reliably enter the loop, and the live dashboard is unavailable.

**Cut list:** keep cohort 1 on player coordination and WhatsApp booking. Do not activate club-dashboard operations, live booking, or further growth features until the core loop is rehearsed.

**Fix list:** restore `racketbound.com` and ship the https invite landing; repair local migration drift and get the RLS/RPC suite green; rehearse the two-player staging loop on physical Android devices including a received push; update E2E for the real package, Google sign-in and mandatory core-flow assertions; surface schedule-conflict warnings before publication.

---

## Found beyond the audit

| Issue                                                                                               | Status                                                    |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A signed-out invitee lost the invite on sign-up                                                     | Fixed (`6cec193`)                                         |
| `process-notifications` answered every cron call 401 since setup                                    | Fixed; function v4 on `sb_secret`                         |
| Push registration errors were swallowed                                                             | Reported to Sentry (`5fc5f0c`)                            |
| Onboarding no longer asks for notification permission                                               | Documented; the rehearsal enables it in Profile           |
| Vercel production frozen on `pilot-handover` since 2026-09-12                                       | Production branch now `staging`                           |
| Blocked player could read invite details; shared-link Decline failed; Accept offered to wrong level | Fixed in `107`/`108`, live on staging (2026-09-25 review) |
| Fingerprint runtime version failed every build started from Windows                                 | `appVersion` policy, version `0.1.0`                      |
| A late slot ended before it started (create, reschedule, add-time, court confirmation)              | Fixed with `slotWindowUtc`                                |
| Staging `service_role` key exposed in a screenshot                                                  | Phase 1 done; **phase 2 pending — key still valid**       |
| A local tool rewrites working-tree files with CRLF                                                  | Harmless to commits; source not identified                |

## Remaining, in order

1. Point `NEXT_PUBLIC_GET_APP_URL` at build `168b2257…`; install it on the test phones.
2. Focused compatibility check on that build (sign-in, a match hub, an invite preview, push token 0 → 1).
3. Retire the legacy keys (checklist §7d), recording the cutoff and reviewing the exposure window.
4. Ship the conflict warning, French and the midnight fix to the installed builds with `eas update`.
5. Two-phone rehearsal against the final configuration (§7c), recorded; run the Maestro loop once and fix what it finds.
6. Later: Android App Links, gate on committed content, prune plus-tagged staging users.
