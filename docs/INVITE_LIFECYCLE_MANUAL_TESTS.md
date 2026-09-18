# Invite lifecycle — manual test list (Phases 1 and 2)

Covers what shipped in Phase 1 (client-only) and Phase 2 (migration `098`) of [`INVITE_LIFECYCLE_PLAN.md`](INVITE_LIFECYCLE_PLAN.md). Automated coverage is already green — 263 pgTAP, 691 unit tests — so **everything below is the part tests cannot see**: layout, wording, what the screen implies, and whether the right thing is reachable.

Pair with [`PHASE_0_MANUAL_REHEARSAL_GUIDE.md`](PHASE_0_MANUAL_REHEARSAL_GUIDE.md) for the broader workflows.

## Setup

**No `db:reset` needed.** Your local DB is already on `098`, has zero pending invitations, and no player has an active hosted match — a clean start. Reset only if you want the 9 historical matches gone; it will wipe local data.

```bash
pnpm dev:mobile
```

Two sessions signed in at once (device + simulator, or two simulators).

| Login                          | Name       | Band         | Note                                      |
| ------------------------------ | ---------- | ------------ | ----------------------------------------- |
| `player-a@tennis-lebanon.test` | Player A   | intermediate | use as **host**                           |
| `player-b@tennis-lebanon.test` | Player B   | improving    | use as **second player**                  |
| `player-c@tennis-lebanon.test` | Player C   | intermediate | **Player A blocks them** — invisible to A |
| `player-d` … `player-j`        | Player D–J | mixed        | invite targets                            |

Password for every account: `password`. Band order is beginner → improving → intermediate → advanced → competitive; **create every test match with min `beginner` and max `competitive`** so nobody is excluded for the wrong reason.

### Two limits that will stop you mid-list

Both are real product rules, not test-rig quirks, and both bite if you work straight down this list as one player.

- **Three active hosted matches per player** (`087`). This list creates six as Player A. **Cancel each test match when you finish with it** — the ✕ on its card in Matches — or you will be refused the fourth and it will look like a bug in the invite work.
- **Twenty invitations per player per day** (`044`, quota is per _player_, not per match). T8 alone spends eight. If you re-run the list the same day, host as Player B instead, or you will hit the daily limit and read it as the new per-match cap. **T8 distinguishes exactly these two messages, so run T8 before you are anywhere near twenty.**

### Two things that will look broken and are not

- **No push notifications land locally.** `060` needs Vault secrets that are absent in local dev, so `invoke_process_notifications` is a no-op. An empty notification centre is the correct local result. Verify push on staging instead.
- **Only the host sees the Invited section.** That is by design (`093`) — and Phase 4 will widen it slightly, see Known gaps.

---

## Phase 1 tests

### T1 — The invite screen remembers who you already asked _(the headline fix)_

1. As **A**, create a **doubles** match, publish it.
2. Open **Invite players**. Invite **Player E**.
3. Row changes to **Invited** and is no longer tappable.
4. **Tap back to the hub, then go into Invite players again.**

**Pass:** Player E still reads **Invited**.
**Fail:** Player E reads **Invite** again — that was the bug, and it let you invite the same person twice.

Also check: pull-to-refresh on that screen keeps the row as Invited.

### T2 — A decline is visible, and re-inviting is deliberate

1. Continue from T1. As **E**, go to **Matches → Invites** and **Decline**.
2. As **A**, open the hub.

**Pass:** the Invited section shows Player E as **Declined**, with a red/critical pill carrying a _different icon_ from the "Waiting to answer" pill.
**Fail:** Declined and Waiting look alike — same grey-blue pill, same `info` glyph. That was T1d's fix.

3. As **A**, open Invite players again.

**Pass:** Player E's button reads **Invite again** and is tappable.
**Fail:** it reads plain "Invite" (loses the warning) or is disabled (loses the only way to re-ask).

### T3 — Requests you sent have a home

1. As **A**, create a **singles** match and tick **require approval**. Publish.
2. As **B**, find it in Discover and **Request to join**.
3. As **B**, go to **Matches → Invites**.

**Pass:** below any invitations there's a **"Requests you sent"** heading with the match, pill reading **Request sent**, and a **Cancel request** button.
**Fail:** it only appears under **Active**, or appears in _both_ places.

4. Look at the **Matches tab badge** before and after step 2.

**Pass:** the badge does **not** increase. A sent request waits on someone else.
**Fail:** the badge counts it.

5. Tap **Cancel request**.

**Pass:** the row disappears; as **A**, the hub's Join requests section is empty.

### T4 — A full match calls its queue a waitlist

1. As **A**, create a **singles**, **approval-required** match. Publish.
2. As **D**, request to join. As **A**, confirm the hub shows **Join requests** with a working **Approve**.
3. **Don't approve.** Instead, as **A**, invite **Player J** and have J accept from Matches → Invites. The match is now 2/2.
4. As **A**, reopen the hub.

**Pass:** the section is now titled **Waitlist**, carries a sentence explaining the match is full, **Approve is greyed out**, and **Reject still works**.
**Fail:** still says "Join requests" with a live Approve.

5. Force the old failure: with the match full, tap Approve if it is somehow still enabled.

**Pass (if reachable):** the message names the cause — "This match is already full." — not "We could not update this request."

### T5 — Join failures name the cause

Hard to stage by hand; worth one attempt. With a singles match at 2/2, have a third player open it by deep link and try to join.

**Pass:** "That match filled up before you got in."
**Fail:** "We could not join this match." — the generic copy. This one is a real behaviour change: those specific messages existed but were **unreachable** before, because the error check tested `instanceof Error` and Supabase rejects with a plain object.

---

## Phase 2 tests

### T6 — The host can take an invite back _(the gap you spotted)_

1. As **A**, create a doubles match. Invite **Player F**.
2. As **F**, confirm it appears in **Matches → Invites** — then leave it unanswered.
3. As **A**, open the hub's Invited section.

**Pass:** each waiting row has a **Withdraw** action. Tap it.
**Fail:** the section is still read-only badges.

4. As **F**, refresh Matches → Invites.

**Pass:** the invitation is gone, with **no notification** about it. A withdrawn offer nobody answered should just disappear.

5. As **A**, check the hub.

**Pass:** Player F is gone from Invited entirely — **not** listed as "Declined". This is the distinction `093` built `declined_at` for; withdrawing must not put words in the invitee's mouth.

6. Check a **declined** row (from T2).

**Pass:** declined rows have **no** Withdraw action — that answer is the record.

### T7 — A non-host participant can withdraw their own invite

1. As **A**, create a doubles match. As **B**, join it.
2. As **B**, open the hub → **Invite players** → invite **Player G**.
3. As **B**, open the hub.

**Known gap, not a bug:** B will **not** see an Invited section — it is host-only until Phase 4. Verify from A's side instead:

4. As **A**, open the hub.

**Pass:** A sees Player G under Invited and can Withdraw it, even though B sent it. The host owns the match.

### T8 — The per-match invite cap

Run this **before** you have spent many invites today — the whole point is telling the
per-match cap apart from the daily one, and a host near twenty gets the wrong message for
the right reason.

1. As **A**, create a **doubles** match (3 open seats → 5 pending invites allowed).
2. Invite **E, D, F, I, G** one at a time. All five should succeed.
3. Invite **Player H** — the sixth.

**Pass:** a message about having enough invites out _for this match_, telling you to withdraw one — **not** the daily-limit message.
**Fail:** it says you have hit a daily limit (wrong remedy: waiting won't help) or it succeeds.

4. Withdraw one from the hub, then invite H again.

**Pass:** succeeds.

5. Re-invite someone who **already** holds a pending invite (say E), while still at the cap.

**Pass:** succeeds. Re-inviting replaces their invitation rather than adding a sixth.

### T9 — Blocked players stay blocked

As **A**, open Invite players and look for **Player C**.

**Pass:** Player C does not appear. The seed has A blocking C, and the block is checked before any of the new guards.

---

## Known gaps — all now closed

Every gap this list originally carried was closed by Phases 3 and 4. Kept as a record of what changed, so a re-run knows what to expect.

| Originally                                        | Now                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Invites vanished silently when a match filled     | Suspended, and the player is told once, pointing at Discover (`099`)                    |
| Invites sometimes came back, sometimes not        | Both fill paths behave identically; a reopened seat restores and notifies (`099`)       |
| A non-host inviter saw no Invited section         | Pending and suspended invitations reach every accepted participant (`100`)              |
| Someone invited _and_ requesting appeared twice   | The roster row wins; they leave the invited list (`100`)                                |
| Declining then being re-invited showed them twice | One row per player, newest live invitation wins (`100`)                                 |
| A pending requester's hub said nothing            | `request_pending` banner: "You have asked to join. The host will let you know." (`100`) |

Two states are new and worth checking on a re-run:

- **"On hold — match full"** on an invited row whose match filled. Withdraw stays available; only a declined row loses it.
- A **decline is still private** — visible to the host and to whoever sent that invitation, not to the rest of the roster.

## Found by running this list

Recorded so they are not re-investigated.

- **A regression, now fixed.** Removing the session-local id list fixed double-invites for the host but broke the non-host inviter: their own invite left no mark on the row, because `invited_players` is creator-only. `invitePlayerState` now takes `invitationsVisible` and falls back to the session list for viewers the server tells nothing. Verified as Player B inviting Player G.
- **Home contradicts the Matches tab.** The Matches tab files a sent join request under "Requests you sent"; Home still lists the same match under **"Upcoming matches"**. The card says "Request sent", so nothing is untrue, but the heading is wrong and the surfaces disagree. `HomeDashboard` uses `sortUpcomingMatches`, which does not apply `isSentJoinRequest`. Not yet fixed.
- **`ready_to_book` always implies a full roster** — confirmed live when filling a singles match flipped it straight past `full`. This is why the Phase 3 model needs no separate booking-time rule.

## If something looks wrong, grab the state

```bash
docker exec supabase_db_tennis-lebanon-claude-code psql -U postgres -d postgres -c "select p.display_name, mi.accepted_at, mi.declined_at, mi.revoked_at, mi.expires_at from public.match_invitations mi join public.profiles p on p.id=mi.invited_user_id order by mi.created_at desc limit 10;"
```

The three timestamp columns are the whole model: `declined_at` set means the player said no; `revoked_at` alone means it was withdrawn; both null and unexpired means still waiting.

```bash
docker exec supabase_db_tennis-lebanon-claude-code psql -U postgres -d postgres -c "select m.id, m.status, m.format, count(*) filter (where mp.status='accepted') accepted, count(*) filter (where mp.status='requested') requested from public.matches m left join public.match_participants mp on mp.match_id=m.id where m.status in ('open','full','ready_to_book') group by 1,2,3;"
```

## What to write down

Per the Phase 0.4 rule: **record hesitations, not just failures.** If you paused to work out what a screen meant, that is the finding — the automated tests already prove it functions.
