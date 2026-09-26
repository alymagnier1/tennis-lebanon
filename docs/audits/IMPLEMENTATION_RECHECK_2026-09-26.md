# Implementation recheck — 2026-09-26

Reviewed `docs/HANDOVER_2026-09-26.md` first, then `docs/STAGING_CHECKLIST.md`, against local HEAD **`62b9a1c`**. Application changes through PR #15 are present; PR #16 adds the handover.

**Verdict: most planned implementation is present; the checklist is not resolved.** It contains **16 checked and 57 unchecked items**. These are not 57 defects: some concern later production or club operations. Credential retirement, device/update confirmation, actual push receipt and the recorded rehearsal remain explicit open gates. No boxes were marked complete by this review.

## Original five-point fix list

| Item                                                          | Current assessment                                                                                                                                                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore domain and HTTPS invite landing                       | Implemented; public routes were independently checked in the September 25 review. No new deployment verification in this pass.                                                                                                   |
| Repair migration drift and get RLS/RPC suite green            | Clean 001–108 rebuild and 351 assertions are recorded. Current rerun could not connect because Docker's Linux engine is stopped; this is unavailable verification, not a failing assertion.                                      |
| Two-player device rehearsal and received push                 | Still open. Handover records one emulator and one phone signed in, zero push tokens and no received push.                                                                                                                        |
| Update E2E for current package, Google sign-in and core flows | Partial. Package and selectors updated; publish/join/court-confirmation flows written. Maestro has never run, and Google sign-in, onboarding, voting, physical push and attendance/result are not covered by the automated loop. |
| Schedule-conflict warning before publication                  | Implemented for the current fixed-slot create screen; advisory banner and match link are wired to the RPC. Device rendering remains unverified, and the account-scoping defect below needs correction.                           |

The three earlier invite fixes are present in migrations 107/108 and the mobile decline handler. The new build-info display is wired to the actual `expo-updates` values. `slotWindowUtc` is used by creation, add-time, reschedule and external-court confirmation. French strings were changed; linguistic and visual quality have not been certified here.

## Findings

### P2 — Scope conflict results to the signed-in account

`apps/mobile/app/match/create/schedule.tsx:386–394` keys `agreed-time-conflicts` by time window only and treats the result as fresh for 30 seconds. `apps/mobile/src/providers/AuthProvider.tsx:60–61` removes only `own-profile` queries on sign-out.

When A checks a slot and B signs in on the same running app and checks that slot within the freshness window, B can receive A's cached conflict without querying B's commitments. This displays the wrong match/time and can expose A's appointment information. The mutation remains server-authorized, but the warning is inaccurate and crosses the account boundary.

A focused reproduction using the installed TanStack Query client returned A's synthetic conflict to B, with `playerBQueried: false`. Script: `output/claude-review-2026-09-26-cache.mjs`. This exercises cache behavior, not a physical screen walkthrough.

**Action — mobile, before closing the conflict-warning item:** include the authenticated user ID in the query key and disable the query until an authenticated user is available. Add an account-switch regression test. Consider clearing other user-scoped cached queries at the authentication boundary as a separate review.

### P2 — T7 cannot produce two device tokens with the documented hardware

`docs/HANDOVER_2026-09-26.md:19` identifies A as an emulator and B as a physical phone. T7 at line 64 expects both to register, increasing push-token rows from zero to two. But `apps/mobile/src/lib/push-notifications.ts:63–66` explicitly requires `Device.isDevice`; on the emulator, permission state is unsupported and token retrieval returns null.

**Action — rehearsal owner:** use two physical phones for the existing two-phone gate. The emulator can help with coordination and compatibility checks, and the real phone can prove one received push, but that does not satisfy the documented two-phone/two-token criterion. Do not diagnose the emulator's missing token as an FCM failure or delay key retirement waiting for it.

### P2 — The rehearsal asks for a flexible match that the create UI cannot publish

`docs/HANDOVER_2026-09-26.md:75` and `docs/STAGING_CHECKLIST.md:270–281` require a flexible singles match with two proposed times and an agreed-time push after voting. `apps/mobile/app/match/create/schedule.tsx:132–137` hard-codes `fixed` and retains exactly one slot; there is no flexible-mode selection on this screen. The new Maestro loop explicitly uses a fixed match, so it does not resolve the discrepancy.

**Action — product/rehearsal owner:** rewrite the cohort rehearsal around the supported fixed-match journey and name an actual notification generated by that journey. If flexible voting remains a release requirement, specify a supported way to create the flexible fixture and test it separately. Do not mark the flexible voting/agreed-time-push step passed from a fixed-match run. Shared-invite acceptance also should not be treated as proof of a host approving a join request; those are different paths.

### P2 — Fresh login is not a session-refresh test

`docs/STAGING_CHECKLIST.md:325–326` permits signing out and in as an alternative way of verifying session refresh. That obtains a new session and does not exercise the existing session's refresh token. Handover T3/T12 only explicitly request sign-out/sign-in.

**Action — rehearsal owner:** record fresh login and refresh separately. Keep a session signed in across expiry and verify a successful refresh plus an authenticated request, or invoke the client's refresh operation in controlled diagnostics without logging credentials. Repeat the check against the final key configuration.

## Verification performed

- `pnpm verify:pilot`: **PASS** on this checkout. Lint, types and unit-test phases reused Turbo cache (8/8 task results); migration validation and formatting completed. Five existing lint warnings, zero lint errors. Log: `output/claude-review-2026-09-26-gates.log`.
- Fresh focused mobile tests: **4 files / 14 tests PASS** covering invite decline, slot windows, build information and push registration. Log: `output/claude-review-2026-09-26-focused.log`.
- `pnpm db:test --local` via the repository script: **unavailable**, Postgres connection failed. Read-only Docker inspection confirmed its Linux engine pipe is absent. No reset, fixture deletion or staging database operation was performed. Log: `output/claude-review-2026-09-26-db.log`.
- No Maestro execution, device interaction, Play Console deployment, live key-status check or received-push verification was performed. Hosted claims remain recorded evidence from the handover/checklist.

## Remaining release decisions

1. Correct the conflict-query account scope and align the rehearsal instructions with the supported UI and available hardware.
2. Confirm the installed build and running update, complete the focused compatibility check, then retire the exposed credentials and verify the final configuration.
3. Complete and record the device journey, actual received notification, fresh-account invite return and failure recovery. Run the authored Maestro flows and record their outcome.
4. Before opening the pilot, close or explicitly scope the remaining relevant operational gates: recovery/rollback evidence, working crash reporting, operator authorization checks and the documented policy-review requirements. Deferred club operations should remain identified as not applicable to cohort 1.

No application source was changed. This report is an assessment, not release sign-off.

## Resolution (2026-09-26, branch `recheck-fixes`)

| Finding                     | Response                                                                                                                                                                                                                                    | State                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Conflict query not scoped   | `apps/mobile/src/lib/agreed-time-conflicts-query.ts`: key includes the user ID; disabled without a user. Account-switch regression on a real `QueryClient`, confirmed to fail against the old window-only key.                              | Code fixed; needs a new EAS update to reach phones. Broader sign-out cache clearing still open. |
| T7 cannot give two tokens   | Handover T7 now expects 0 → 1 (phone only) and states the emulator cannot register. §7c and Phase D state both roles need physical phones.                                                                                                  | Docs corrected; device items unchecked                                                          |
| Rehearsal asks for flexible | §7c and Phase D follow the fixed journey and name `match_participant_joined` (to host) and `match_court_confirmed` (to joiner). Join-request approval (T27) and flexible voting are separate unchecked items; neither passes from this run. | Docs corrected; flexible voting awaits a scope decision                                         |
| Fresh login ≠ refresh       | §7d splits the compatibility check from a separate session-refresh item (signed in past token expiry, foreground, authenticated request, `refresh_token` grant in Auth logs), repeated after retirement. Handover adds T3b.                 | Docs corrected; unchecked                                                                       |

Checks: `pnpm verify:pilot` PASS (5 existing lint warnings, 0 errors; mobile 98 files / 666 tests). `pnpm db:test` not run — Docker's Linux engine is stopped; no SQL changed. Checklist now 16 checked / 60 unchecked; nothing newly ticked.
