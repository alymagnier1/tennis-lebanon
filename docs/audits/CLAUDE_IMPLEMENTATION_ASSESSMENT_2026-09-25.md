# Claude implementation assessment — 2026-09-25

**Verdict: substantial fixes verified, but not ready to admit real cohort-1 players.** The implementation repairs several earlier failures. However, three reproducible invite defects remain, including a block-filtering privacy regression. The reported exposed service-role key is still awaiting retirement, and the physical-device rehearsal remains unproven. “Server-side blockers are cleared” is therefore too strong.

Reviewed local commit **`3d52938`**, branch `supabase-new-keys`, including the earlier changes merged at `9aa8a74`. The supplied status note is treated as a set of claims to verify, not as proof of hosted configuration. This was an assessment using the code-quality skill; no application fixes, remote mutations, database resets, or key changes were made.

## Findings requiring changes

### 1. P1 — Blocked players can preview an old shared invitation

**Source:** `supabase/migrations/105_preview_match_invite.sql:138–175`.

`preview_match_invite` is a security-definer function. It checks invitation ownership, revocation, expiry and capacity, but never checks `is_blocked_from_match` before returning the host/inviter names, proposed time, zones and invitation note. A player who received a link before being blocked can continue retrieving these details. The acceptance path does enforce the block through `assert_joinable_match`, so joining is prevented; the disclosure has already happened in the preview.

**Reproduced locally:** create a shared invitation, block its recipient, then call the preview as that recipient. The preview still discloses details, while acceptance raises `42501: Blocked relationship`.

**Required fix:** enforce the block rule before disclosing the preview payload, returning a generic unavailable/not-found response without match details. Add regression coverage for both directions of the block. Deliver this as a new migration so already-deployed databases receive the change.

### 2. P2 — Decline fails for every shared invitation without a named recipient

**Source:** `apps/mobile/app/invite/[token].tsx:263–271`; RPC behavior at `supabase/migrations/093_hub_invited_players.sql:35–58`.

Every successful preview includes `invitation_id`, including shared links whose `invited_user_id` is null. The screen therefore always calls `decline_match_invitation`. That RPC updates only invitations addressed to the current user and raises `P0002` when no row matches. A shared-link recipient sees a decline error instead of leaving the screen. Comments in the screen, API type and migration incorrectly describe this RPC as a harmless no-op for shared links.

**Reproduced locally:** preview a real shared invitation and pass its returned ID to the same decline RPC used by the screen. It raises `P0002: Invite not found or expired`.

**Required fix:** distinguish addressed invitations from shared links in the authenticated preview. Shared-link refusal should dismiss the invitation locally without revoking it for everyone; addressed invitations should retain the existing server-side refusal. Test both branches through the screen or its action handler.

### 3. P2 — Preview offers Accept when the player's skill makes acceptance impossible

**Source:** `supabase/migrations/105_preview_match_invite.sql:129–141`; generic failure copy at `apps/mobile/app/invite/[token].tsx:242–245`.

The preview reports `ok` without checking the recipient's skill against the match's range. `assert_joinable_match` still performs this check during acceptance. A beginner opening an intermediate-or-higher shared invitation sees an enabled Accept button, then a generic error on every attempt.

**Reproduced locally:** preview returns `ok`; acceptance of the same invitation raises `P0001: skill_out_of_range`. This is deterministic eligibility failure, not a race with another player filling the match.

**Required fix:** make preview eligibility agree with the acceptance rules without performing a mutation. Return an explanatory non-joinable state for skill mismatch; keep the acceptance checks authoritative. Also cover the acceptance rule requiring a future time option, which the preview currently omits. Do not expose the names of blocked participants while explaining ineligibility.

## What is verified

| Area                        | Assessment                                                                                                                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local migration/test drift  | Current local database passes **80 files / 327 assertions**, including migrations 104–106 behavior. No reset was needed during this review. A clean rebuild and hosted migration history were not independently rerun.                                                     |
| Automated pilot checks      | `pnpm verify:pilot` passes with Node 20.19.5 / pnpm 10.34.5: lint, types, unit/component tests, migration validation and formatting. Lint reports five warnings and zero errors. Turbo reused seven of eight task results per phase; mobile checks ran freshly.            |
| Public deployment           | Direct read-only HTTPS checks returned **200** for `/invite`, `/login` and `/`. Invite HTML contains `noindex`; the root health page displays “All systems operational.” This does not prove a successful human login or native app handoff.                               |
| Invite acquisition code     | HTTPS fragment links, Android intent fallback, tab-scoped token persistence, native pending-invite storage, and explicit consent are implemented. The defects above prevent calling the whole flow complete.                                                               |
| Notification authentication | Dedicated invoker-token validation and preference for the injected `sb_secret` key exist in source. Push-registration failures are reported with stage/platform context. Hosted v4 configuration and delivery remain supplied evidence, not independently inspected state. |
| Notification unread count   | Migration 106 correctly aligns “mark all read” with the due notifications shown by the list; existing local tests pass.                                                                                                                                                    |
| E2E refresh                 | Correct app ID and current login subflow are present. The four flows remain navigation/form smoke checks; they do not publish, join, vote, book or confirm a result. Execution remains unverified.                                                                         |
| Schedule conflicts          | The conflict RPC exists; no application caller was found. The host's pre-publication warning remains unimplemented.                                                                                                                                                        |
| French                      | The supplied note acknowledges remaining critical-path translation gaps. This review does not certify French or Arabic wording or visual layout.                                                                                                                           |

## Security incident and release order

The attached note reports that the legacy service-role key was exposed on September 22 and remains valid. Replacing callers' credentials is migration progress; it is not revocation of the exposed credential. The incident must stay open until retirement is verified. A green RLS suite does not neutralize a credential that bypasses RLS.

The two-phase approach is sound: migrate all consumers to publishable/secret keys, then disable the legacy API keys and revoke the old signing key. Inventory **EAS build profiles and update environments**, deployed clients, Vercel, cron/workers and CI before the cutoff. The reported non-staging EAS environment variable still needs updating. Supabase explicitly includes installed clients and background integrations in this migration inventory. [Supabase API-key migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)

Correct `docs/STAGING_CHECKLIST.md:270`: **“wait ≥1 hour” is not the documented interruption-free window.** For a one-hour access-token lifetime, Supabase recommends at least **one hour and fifteen minutes** before revoking the previous signing key. Check the actual project's expiry setting. In an active incident, immediate revocation can instead be appropriate, accepting session disruption. Rotation without revocation leaves the old key valid. [Signing-key guidance](https://supabase.com/docs/guides/auth/signing-keys), [legacy-key retirement guidance](https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd)

Do not postpone credential retirement until after the entire match/attendance rehearsal. Once the replacement build and consumers pass a focused compatibility check, retire the exposed credential and run the full rehearsal against the final configuration. Record the cutoff, review available logs for unexpected privileged activity during the exposure window, and verify rejection of the retired credential through an appropriately controlled check. Do not paste the key into chat or logs. This review did not exercise the exposed credential.

## Product and cohort decisions

**Fragment-carried, detail-free landing page: acceptable for cohort 1.** Keeping match details behind authentication is a sensible privacy choice. The fragment avoids sending the token in the ordinary HTTP page request. Client scripts and the browser can still access it, so “never exposed anywhere” would be an overstatement. The extra install/back/open step is an accepted source of friction only after a new player completes it on the actual WhatsApp/browser/device combination. Deferred deep linking and verified App Links can follow later.

**Manual two-phone rehearsal: sufficient as a temporary cohort-1 release gate if actually performed and recorded.** It is currently a checklist, not evidence. Use the exact candidate APK and final backend configuration. Record build/commit, device/OS, results and failures. Exercise fresh-account onboarding, invite return, explicit acceptance and refusal, push received while backgrounded, vote/agreement, WhatsApp booking confirmation, attendance/result and rematch. Include a blocked or invalid invite and a recoverable network failure. Club-staff workflow coverage is not a gate for the stated WhatsApp-only cohort.

**Before broader promotion:** automate the two-player happy path and key authorization/error cases; verify rollback and a restore drill; assign monitoring and incident ownership; complete conflict warnings and supported-language/accessibility checks; measure time to first completed match, completion/no-show rate, rematch conversion and repeat play. Existing instrumentation is not evidence of retention improvement without cohort results.

The current audit archive also needs a dated status reconciliation: the older report still says `/invite` is not live, migration 106 is not on staging, and gives obsolete legacy-rotation sequencing. Preserve the original findings, but avoid using its later status column as current release truth.

## Reproduction evidence and limits

- Existing gates: `output/claude-review-verify-pilot.log` — PASS.
- Existing database suite: `output/claude-review-db-test.log` — 80 files / 327 assertions, PASS.
- Audit regression cases: `output/claude-review-invite-regressions.sql` and `.log` — **three failures out of five assertions**. Two passing assertions establish that acceptance does reject the out-of-range and blocked players; the failing assertions expose shared-link decline and preview behavior. All fixture changes were rolled back.
- No installed Android build, Google login, push receipt, Maestro run, complete visual walkthrough, or hosted secret/migration configuration was independently verified here. No claim of a completed whole-application security audit is made.

**Next release candidate:** fix the three invite defects, retire the exposed credentials after consumer compatibility is proven, then complete and record the two-phone rehearsal. The former numeric readiness score is not reused; these are concrete gates with observable pass/fail evidence.
