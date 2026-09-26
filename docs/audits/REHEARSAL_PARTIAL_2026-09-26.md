# Partial two-player rehearsal — 2026-09-26

Partial run of `docs/STAGING_CHECKLIST.md` §7c / Phase D. **Does not close the
cohort-1 two-phone gate.** Hardware was one physical Android (host A) plus an
emulator (joiner B). Emulator cannot register push (`Device.isDevice`).

Interactive checklist used during the run: Cursor canvas
`two-phone-rehearsal.canvas.tsx` (local to the IDE; not in this repo).

## Environment

| Item                           | Value                                                     |
| ------------------------------ | --------------------------------------------------------- |
| Date                           | 2026-09-26                                                |
| Roles                          | PA = physical phone (host); PB = emulator (joiner)        |
| EAS build                      | `168b2257-439f-4868-8acf-70f668009537`                    |
| Runtime / channel              | `0.1.0` · staging                                         |
| EAS update (confirmed on both) | `01a0dcac-e8d8-75f6-94db-e69a2e1e7a5a` (commit `e6f7bf7`) |
| Staging project                | `rvdzalxavpcijbiikkjz`                                    |
| Migrations                     | 001→108                                                   |
| `process-notifications`        | v4; cron `*/5 * * * *`; join pushes marked `sent_at`      |
| Active push tokens             | 1 (phone only) during the run; 0 after 12:47 (finding 8)  |

Device model / Android version for the physical phone: **not recorded this session** — fill in before ticking the checklist “Recorded: … model and Android version” row.

## Passed on this hardware

- T1: both devices on update `01a0dcac…` (Settings build info).
- Create fixed-time singles → publish → share `https://racketbound.com/invite#…`.
- PB opens invite → Accept joins; hubs update.
- **T18:** PA phone received **OS** `match_participant_joined` (bell alone is not enough; cron delay up to 5 min).
- Court: WhatsApp hand-off opened; PA confirmed court; both hubs showed match on / confirmed.
- Shared Decline: leaves cleanly; `declined_at` stays null; same link still joinable.
- Addressed Decline: `declined_at` set; PA hub shows **Declined**.
- Out-of-level: PB saw level copy, **Find another match**, no Accept.
- Offline recovery on PA: data off → on, hub recovers without force-quit.
- T27: Discover + requires approval → PB requests → PA approves; `match_join_request` sent via push to PA. PB acceptance push not proved on a physical device.

## Not passed (still open for §7c)

- Two physical phones / two active `device_push_tokens`.
- Cold path: B with no account / app → Get the app → onboarding → land on invite.
- T19: OS `match_court_confirmed` on joiner device.
- T20: attendance + mutual score + rematch (fixture was Mon 28 6pm).
- Blocked-player invite (skipped this session).
- Arabic RTL smoke.
- `unreachable_notification_summary()` (MCP role lacked EXECUTE; re-run in SQL editor as operator).
- Sentry check for `expo-push-token` / `register-device-push-token` stages.
- Flexible voting / agreed-time push (create UI cannot publish flexible; needs a decision).

## Surprises / findings (write before fix)

1. **Cancelled-match invite copy.** Reopening an invite for a match PB already joined, after cancel, shows “You are already in this match” → hub shows cancelled. Membership is checked before match status. Easy to confuse with a _new_ same-time match invite if WhatsApp still has the old bubble. Tokens checked: `d67dad03…` → cancelled X; `2fc61249…` → open Y.
2. **Invite web page strips `#token`.** After load, address bar becomes `/invite` and the token lives in tab `sessionStorage`. Same-tab “Open in the app” can reopen the previous token. _Fixed 2026-09-26 (#25): the page now follows `hashchange`._
3. **False offline on emulator.** Banner keys off `Network.isInternetReachable`; `Boolean(null)` marks offline and pauses React Query while Wi‑Fi/Google still work (`apps/mobile/app/_layout.tsx`). Treat `null` as unknown/online. _Fixed 2026-09-26 (#25), with a corrected cause: on Android the value is never `null`; it is `false` when Android has not validated the network or a VPN reports zero bandwidth. The founder's phone later showed the banner from a different cause (a stale state after the app was in the background), which #25 does not fix; see the handover._
4. **Al Riyadi booking phone** `+961 1 740 255` is a landline; WhatsApp offers SMS invite — not an app SMS feature. Staging club numbers should be WhatsApp mobiles.
5. **Invite screen has no in-app back** — Accept / Decline only (Decline leaves shared links).
6. **No profile photo → initials** (`AM` for Ali Mogh) — expected, not a missing avatar bug.
7. **Home bell can light before OS push** — outbox row exists; Expo delivery waits for the 5‑minute cron.
8. **Switching accounts on the phone stopped its push** (found in review, from logs). At 12:47 the phone signed out and signed in with a different Google account for T3. `register_device_push_token` returned 409 (`duplicate key value violates unique constraint "device_push_tokens_token_key"`) then and on every foreground after. The old row was only deactivated and still held the token. Active tokens went to 0. Fixed by migration `109`.

## Verdict

Core fixed-time loop and several invite edges work on staging with one phone + emulator. **§7c remains open** until a second physical phone proves joiner push / two tokens, cold acquisition is walked, blocked invite is checked, and attendance is run after start (or on a past-time fixture).
