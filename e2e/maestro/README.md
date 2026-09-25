# Maestro flows

Run against the **staging** build (`com.racketbound.app`) on a physical Android
phone or an emulator with the staging APK installed.

> **Status (2026-09-25): written, never executed.** Maestro is not installed on
> the machine these were written on. Treat the first run as authoring: expect to
> adjust a step or two, and record the result before relying on the suite.

## Accounts

Two fully onboarded staging accounts with email + password. Pass them as env
vars in your own terminal; never commit them or paste them into chat.

```bash
maestro test e2e/maestro \
  -e PLAYER_A_EMAIL=... -e PLAYER_A_PASSWORD=... \
  -e PLAYER_B_EMAIL=... -e PLAYER_B_PASSWORD=...
```

The core loop also needs both display names, exactly as the app shows them:

```bash
maestro test e2e/maestro/loop/l1-host-publishes.yaml e2e/maestro/loop/l2-joiner-joins.yaml e2e/maestro/loop/l3-host-confirms-court.yaml \
  -e PLAYER_A_EMAIL=... -e PLAYER_A_PASSWORD=... -e PLAYER_A_NAME=... \
  -e PLAYER_B_EMAIL=... -e PLAYER_B_PASSWORD=... -e PLAYER_B_NAME=...
```

Run the loop files in that order; each continues from the state the last one
left.

## What is covered

| Flow                          | Checks                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `m1-sign-in`                  | Welcome → Log in → email/password → tabs                                              |
| `m2-create-match`             | Create tab opens the form with When / Where / Publish                                 |
| `m3-discover-open-matches`    | Second account reaches Discover → Open matches                                        |
| `m4-my-matches`               | Matches tab, Invites and Active segments                                              |
| `loop/l1-host-publishes`      | A publishes a fixed match at the default slot → hub shows "Open for players"          |
| `loop/l2-joiner-joins`        | B finds it on Discover by A's name, joins → "Ready to book"                           |
| `loop/l3-host-confirms-court` | A records the court booked off-app (first listed club) → confirm dialog → "Confirmed" |

### Loop preconditions

- Player A's match defaults are **singles**, listed on Discover, no join approval.
- Player A has **fewer than three** active hosted matches (the hosting cap
  disables Publish).
- Neither player is blocked by the other, and B's level is inside A's range.

## Stable selectors

The loop taps `testID`s, not copy, wherever one exists: `tab-create-match`,
`create-publish`, `hub-action-<kind>` (the hub's main button: `join`,
`request_join`, `confirm_external_court`, `invite`), `club-card-<index>`,
`court-confirm`, `confirm-dialog-confirm` / `confirm-dialog-cancel`. Add one
rather than matching text when extending the suite.

## Not covered — run by hand

In the two-player rehearsal, `docs/STAGING_CHECKLIST.md` §7c:

- Google sign-in (system account picker)
- sign-up and onboarding (needs a fresh address and its email code)
- the WhatsApp hand-off itself (leaves the app)
- invite links opened from WhatsApp
- push notifications received
- attendance and result (needs the match start time to have passed)
