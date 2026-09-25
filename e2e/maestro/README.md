# Maestro smoke flows

Run against the **staging** build (`com.racketbound.app`) on a physical Android
phone or an emulator with the staging APK installed.

## Accounts

Two fully onboarded staging accounts with email + password. Pass them as env
vars; never commit them.

```bash
maestro test e2e/maestro \
  -e PLAYER_A_EMAIL=... -e PLAYER_A_PASSWORD=... \
  -e PLAYER_B_EMAIL=... -e PLAYER_B_PASSWORD=...
```

## What is covered

| Flow                       | Checks                                                |
| -------------------------- | ----------------------------------------------------- |
| `m1-sign-in`               | Welcome → Log in → email/password → tabs              |
| `m2-create-match`          | Create tab opens the form with When / Where / Publish |
| `m3-discover-open-matches` | Second account reaches Discover → Open matches        |
| `m4-my-matches`            | Matches tab, Invites and Active segments              |

## Not yet covered — run by hand

Selectors here are visible English copy; the app has almost no `testID`s. The
rest of the loop is in the two-player rehearsal in
`docs/STAGING_CHECKLIST.md` until it is authored against a real device:

- Google sign-in (system account picker)
- sign-up and onboarding (needs a fresh address and its email code)
- publish → join → vote → agreed time → WhatsApp court hand-off → court confirmed
- attendance and result (needs the match start time to have passed)

When authoring those, add `testID`s to the controls they tap rather than
matching copy, so a wording change does not break the suite.
