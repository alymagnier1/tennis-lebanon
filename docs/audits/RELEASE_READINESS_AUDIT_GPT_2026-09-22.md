# Release readiness audit (GPT) — pre 2026-09-22

**Verdict as given: NOT DONE (4/10).** "The app is not ready to promote beyond a tightly controlled cohort-1 rehearsal. The core product direction is sound, but release evidence and the acquisition loop have material gaps."

Author: GPT, via chat. Recorded here 2026-09-25 so it survives the conversation, per [`CHAT_AUDITS_INDEX.md`](../CHAT_AUDITS_INDEX.md).

**Dating.** The audit cites `e2e/maestro/m1-auth-onboarding.yaml`, which `839a108` deleted on 2026-09-22, and reports Maestro using `com.tennislebanon.dev`, which the same commit changed. So it was run **before 2026-09-22** and is at least three days and ~60 commits stale as recorded.

The findings are reproduced as written. The **Status** column is a later verification pass and is not the auditor's. It was first written on 2026-09-25 and re-checked the same day against the repo, hosted staging and the live domain.

**Where it stands:** 2 findings done, 1 done pending a deploy, 3 partly done, 2 not started. Both server-side blockers are cleared — the RLS/RPC suite passes and the domain and notification sender work. What remains before cohort 1 is mostly shipping: deploy `/invite`, rotate the staging key, cut an EAS build, and rehearse with two phones.

---

## Findings

| P   | Finding                                          | Status (re-checked 2026-09-25)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0  | Local RLS/RPC test suite fails (`104` missing)   | **Done.** Local drift from branch switching: the local database had been built on `invite-consent` (105, no 104). After `pnpm db:reset`, `pnpm db:test` passes — 80 files / 326 tests on 2026-09-22, 327 with 106. Staging had 001→104 contiguous; 105 was applied on 2026-09-22 with `supabase db push`, so it is now 001→105.                                                                                                                                                                                                                                    |
| P0  | Shared invites cannot acquire new players        | **Code done, not live.** Links are `https://racketbound.com/invite#<token>` (token in the fragment, never sent to the server); `/invite` is a public static page in the dashboard; a signed-out invitee is brought back to the invite after sign-up and onboarding (`pending-invite.ts`); the consent screen and `preview_match_invite` (105) are on staging. **Left:** deploy `/invite` (404 today), ship an EAS build — installed builds still share `tennislebanon://` — and test it on a real phone.                                                           |
| P0  | Dashboard is not a reliable staging surface      | **Done.** It was never a 500: `racketbound.com` had no A record. Now `A @ 216.198.79.1`, HTTPS live, `/login`, `/legal/*` and `/admin/reports` return 200, `www` redirects to the apex. **Left:** a real sign-in on the domain has not been tried; the Google consent screen can now be published (founder).                                                                                                                                                                                                                                                       |
| P1  | Push delivery remains unproven                   | **Half done.** The sender itself was broken: every cron call was answered **401** since setup. Fixed in `aa7564d` with a dedicated `PROCESS_NOTIFICATIONS_TOKEN` (function v3, deployed 2026-09-22); runs now return 200. Registration failures report to Sentry (`5fc5f0c`). **Left:** `device_push_tokens` still has **0 rows, ever**, so nothing can be delivered. Needs an EAS build with FCM confirmed, a tester enabling Profile → Notifications (onboarding no longer asks), and one push physically received. Joiner-accepted notification still untested. |
| P1  | E2E smoke tests are stale and shallow            | **Half done.** `839a108`: every flow targets `com.racketbound.app`, sign-in uses the current email/password screen through a shared subflow, nothing is optional. The two-player rehearsal is written step by step in `docs/STAGING_CHECKLIST.md` §7c. **Left:** the loop (create → join → vote → court → result) is not automated — it needs a device and `testID`s — and Maestro has never been run.                                                                                                                                                             |
| P1  | Pilot gate is red (Prettier on `.cursor/skills`) | **Committed code is green; the red is the working tree.** Every failure seen was line endings: some tool rewrote the same ~26–50 files with CRLF on 2026-09-22 20:59 (leaving a stale `index.lock`) and again on 2026-09-25 01:47, with no content change. `.gitattributes` normalises on commit, so nothing bad is committed, but `verify:pilot` reads the tree. **Left (optional):** gate on committed content, or find the tool doing the rewriting. `pnpm format` clears it meanwhile.                                                                         |
| P2  | Creation does not warn about schedule conflicts  | **Not started.** `viewer_agreed_time_conflicts` exists and is tested; nothing calls it. Migration 090's comment claims the create review step uses it — it does not.                                                                                                                                                                                                                                                                                                                                                                                               |
| P2  | French quality is incomplete                     | **Not started.** 44 keys match English, most of them placeholders (`you@example.com`); roughly 20 are genuinely untranslated. The `onboarding.notifications.*` strings the auditor named belong to a screen that is now a stub, so nobody sees them.                                                                                                                                                                                                                                                                                                               |

## Security posture (as given)

Good foundations: Supabase session storage uses SecureStore on native; auth callbacks allow only the intended schemes; Sentry disables default PII collection; privileged database functions are explicitly revoked from public roles. The exposed Supabase anonymous key in the EAS config is expected client configuration, not a service-role secret.

Explicitly **not** marked complete: the authorization suite was failing from migration drift, and hosted staging could not be inspected directly. No confirmed critical or high source-level vulnerability was found in the reviewed code, "but that is not a substitute for a clean RLS matrix on the rebuilt local database and staging spot checks."

**Status (2026-09-25):** both conditions are now met — the RLS/RPC suite is green on a rebuilt local database, and staging was spot-checked (`preview_match_invite` and `accept_match_invite` execute for `authenticated` only, not `anon`). **New item:** the staging `service_role` key appeared in a chat screenshot on 2026-09-22. It has been removed from Vault (the sender no longer uses it) but is not yet rotated. Rotate it before any real player joins.

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

| Issue                                                                                     | Status                                                                     |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A signed-out invitee lost the invite on sign-up; onboarding ended on Home                 | Fixed (`6cec193`)                                                          |
| `process-notifications` answered every cron call 401 since setup                          | Fixed and deployed (`aa7564d`, function v3)                                |
| Push registration errors were swallowed                                                   | Reported to Sentry (`5fc5f0c`)                                             |
| Onboarding no longer asks for notification permission, so sign-in never registers a token | Documented; the rehearsal enables it in Profile                            |
| Generated database types had the 105 enum as a type union under `Constants`               | Fixed (`1e49b19`)                                                          |
| Staging `service_role` key exposed in a screenshot                                        | Out of Vault; rotation pending                                             |
| Migration 106 ("Mark all read" clears what the player can see)                            | In the repo and tested locally; **not on staging**                         |
| A tool rewrites working-tree files with CRLF                                              | Harmless to commits; cleared with `pnpm format`; source not yet identified |

## Sequencing note

The rebuild belongs **before** the rest of this plan, not after.

Only one finding needs a native build — P1 push — and it cannot be closed without one, since a device token can only come from a build carrying FCM. Everything else is Vercel, local database, test files, or JS. And once `expo-updates` (`1e0bd3d`) is in a build, the JS items ship over the air, so building early makes the remainder cheaper rather than more expensive.

Nothing outstanding requires new native code, so deferring the build batches nothing.

Two things have to come **before** that build, though:

- **`/invite` deployed.** The build shares `https://racketbound.com/invite#…`; if the page is still 404 when testers use it, the acquisition loop is broken on day one.
- **The staging key rotated.** Rotating the legacy JWT secret changes the anon key the build embeds; rotating after the build means a second build.

## Remaining, in order

1. Push the unpushed commits, open a PR, deploy `/invite` to Vercel.
2. Apply migration 106 to staging.
3. Rotate the staging `service_role` key; update the anon key in `eas.json` and Vercel.
4. EAS staging build (confirm FCM V1 credentials); point `NEXT_PUBLIC_GET_APP_URL` at it.
5. Two-phone rehearsal (`docs/STAGING_CHECKLIST.md` §7c): invite from WhatsApp, push token 0 → 1, a push physically received, court confirmed, result confirmed.
6. P2s: schedule-conflict warning; French.
7. Later: automate the two-player loop in Maestro with `testID`s; Android App Links; gate on committed content; prune plus-tagged staging users.
