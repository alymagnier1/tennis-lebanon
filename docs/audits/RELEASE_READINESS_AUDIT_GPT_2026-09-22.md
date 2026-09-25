# Release readiness audit (GPT) — pre 2026-09-22

**Verdict as given: NOT DONE (4/10).** "The app is not ready to promote beyond a tightly controlled cohort-1 rehearsal. The core product direction is sound, but release evidence and the acquisition loop have material gaps."

Author: GPT, via chat. Recorded here 2026-09-25 so it survives the conversation, per [`CHAT_AUDITS_INDEX.md`](../CHAT_AUDITS_INDEX.md).

**Dating.** The audit cites `e2e/maestro/m1-auth-onboarding.yaml`, which `839a108` deleted on 2026-09-22, and reports Maestro using `com.tennislebanon.dev`, which the same commit changed. So it was run **before 2026-09-22** and is at least three days and ~60 commits stale as recorded.

The findings are reproduced as written. The **Status** column is a later verification pass (2026-09-25) and is not the auditor's.

---

## Findings

| P   | Finding                                          | Status as of 2026-09-25                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0  | Local RLS/RPC test suite fails (`104` missing)   | **Narrowed — local only.** Staging's migration history is contiguous 001→105 with 104 present. Not schema drift on the server. Still needs `pnpm db:reset && pnpm db:test`.                                                                                                                                                                                                                                                                                                |
| P0  | Shared invites cannot acquire new players        | **Code closed, blocked on hosting.** `buildMatchInviteUrl` returns the https URL via `buildInviteWebUrl(env.INVITE_BASE_URL, token)`, default `https://racketbound.com`. The landing page exists at `apps/dashboard/src/app/invite/`. Needs the domain pointed at Vercel.                                                                                                                                                                                                  |
| P0  | Dashboard is not a reliable staging surface      | **Open.** Same unblock as above.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| P1  | Push delivery remains unproven                   | **Open, and now root-caused.** `device_push_tokens` holds **0 rows, ever**. No recipient exists, so nothing is stamped `sent_at` — 107 notifications, 0 delivered. Needs an EAS build carrying FCM.                                                                                                                                                                                                                                                                        |
| P1  | E2E smoke tests are stale and shallow            | **Half closed.** Package fixed in `839a108`; every spec now reads `appId: com.racketbound.app`. The mandatory two-player loop assertions are still not written.                                                                                                                                                                                                                                                                                                            |
| P1  | Pilot gate is red (Prettier on `.cursor/skills`) | **Structural, not a one-off.** `verify:pilot` runs Prettier over the **working tree**, not the commit, so any file open in another editor turns the gate red -- green on 2026-09-24 with a clean tree, red again on 09-25 with 26 files being edited concurrently. `.gitattributes` normalises on `git add`, so nothing reaches a commit. The auditor's fix still applies: exclude local tool-skill files, and consider checking `git diff --cached` rather than the tree. |
| P2  | Creation does not warn about schedule conflicts  | **Open.** `viewer_agreed_time_conflicts` exists and is tested; nothing calls it.                                                                                                                                                                                                                                                                                                                                                                                           |
| P2  | French quality is incomplete                     | **Open.** 44 keys match English, though most are placeholders (`you@example.com`); roughly 20 are genuinely untranslated.                                                                                                                                                                                                                                                                                                                                                  |

## Security posture (as given)

Good foundations: Supabase session storage uses SecureStore on native; auth callbacks allow only the intended schemes; Sentry disables default PII collection; privileged database functions are explicitly revoked from public roles. The exposed Supabase anonymous key in the EAS config is expected client configuration, not a service-role secret.

Explicitly **not** marked complete: the authorization suite was failing from migration drift, and hosted staging could not be inspected directly. No confirmed critical or high source-level vulnerability was found in the reviewed code, "but that is not a substitute for a clean RLS matrix on the rebuilt local database and staging spot checks."

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

## Sequencing note

The rebuild belongs **before** the rest of this plan, not after.

Only one finding needs a native build — P1 push — and it cannot be closed without one, since a device token can only come from a build carrying FCM. Everything else is Vercel, local database, test files, or JS. And once `expo-updates` (`1e0bd3d`) is in a build, the JS items ship over the air, so building early makes the remainder cheaper rather than more expensive.

Nothing outstanding requires new native code, so deferring the build batches nothing.
