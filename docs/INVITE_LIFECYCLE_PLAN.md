# Invite and Join Lifecycle — Execution Plan

Fixes the invitation/join-request model end to end: what happens to the other invited players when a seat is taken, what happens when it opens again, whether a full match still takes asks, and who can take an offer back.

Ordered so everything needing **no migration** lands first, then one small migration, then the state-machine change, then the read surface.

**Related:** [`DECISIONS.md`](DECISIONS.md) (four entries dated 2026-09-13) · [`FLOWS_AND_SCREENS.md`](FLOWS_AND_SCREENS.md) · [`LIFECYCLE.md`](LIFECYCLE.md) · [`TESTING_SECURITY.md`](TESTING_SECURITY.md)

## Progress

| Item                                             | Status |
| ------------------------------------------------ | ------ |
| 0 — DECISIONS entries                            | Done   |
| 1a — invite screen reads the hub, not session    | Done   |
| 1b — "Requests you sent" group                   | Done   |
| 1c — waitlist heading and honest Approve         | Done   |
| 1d — Declined badge stops sharing the info glyph | Done   |
| 2 — `098` cancel invite, create guards, cap      | Done   |
| 3 — `099` supersede state machine                | Done   |
| 4 — `100` hub tells the truth                    | Done   |
| 5 — verification and doc updates                 | Done   |

## The rule this plan implements

An invitation has one non-terminal state and four terminal ones.

| State          | Column                 | Reversible | Set by                               |
| -------------- | ---------------------- | ---------- | ------------------------------------ |
| pending        | all null               | —          | `create_match_invite`                |
| **superseded** | `superseded_at`        | **yes**    | `refresh_match_open_state` when full |
| accepted       | `accepted_at`          | no         | `apply_match_invitation_acceptance`  |
| declined       | `declined_at` + revoke | no         | `decline_match_invitation`           |
| withdrawn      | `revoked_at`           | no         | `cancel_match_invite`, `leave_match` |
| expired        | `expires_at <= now()`  | no         | time                                 |

`ready_to_book` requires `accepted_count >= capacity` in both timing modes (`refresh_match_time_agreement`, `033`), so "the roster is full" covers `full` **and** `ready_to_book`. There is no separate booking-time rule.

Suspension is roster-driven and lives in `refresh_match_open_state`. Termination is status-driven and lives in a new `matches_close_pending_asks` trigger, because `refresh_match_open_state` returns early for every status that terminates.

---

## Phase 1 — Client only, no migration

All four items read data the hub card already returns (`invited_players` shipped in `093`/`094`) or reuse an existing RPC.

### 1a. The invite screen reads the hub instead of session state

`invitePlayerState` resolves "invited" from `participants` plus a session-local `locallyInvitedIds`, but an invitation writes no participant row — `participant_status = 'invited'` is never written by anything in the codebase. Leaving the screen and returning shows every invited player as "Invite" again.

- `apps/mobile/src/lib/invite-player-state.ts` — take `invitedPlayers: {user_id, status}[]` from the hub card; drop `locallyInvitedIds`; return `invite | invited | declined | requested | joined` (add `superseded` in Phase 3).
- `apps/mobile/src/lib/invite-player-state.test.ts` — cover each state, plus a player appearing in both `participants` and `invitedPlayers` (participant row wins).
- `apps/mobile/app/match/[id]/invite.tsx` — delete the `invitedIds` state and its `onSuccess` setter; feed `hub.invited_players`; extend the `primaryLabel` map; keep `primaryDisabled` true for every non-`invite`, non-`requested` state. The existing `invalidateQueries(["match-hub", id])` on success is what refreshes the row.
- Copy: `matches.invite.declinedLabel` in all three locales.

**Acceptance:** invite a player, navigate to the hub, come back — the row reads "Invited". Decline from the other account, refresh — the row reads "Declined" and is not tappable.

### 1b. "Requests you sent" in the Invites segment

No migration: `list_my_matches` already returns `participant_status = 'requested'`, `matchListAction` already labels it "Request sent" (`match-list-card.ts:181`), and `withdraw_join_request` already exists (`092`).

- `apps/mobile/app/(tabs)/matches.tsx` — inside the `invites` segment, render a second group below the invitations, filtered to `participant_status === "requested"`; each row gets a Cancel action calling `withdrawJoinRequest`, invalidating `["my-matches"]`.
- Filter those same matches **out** of the `active` segment so one match is not in two places.
- Badge: `badgeCounts.invites` keeps counting invitations only. A sent request is waiting on somebody else; badging it nags the reader about something they cannot act on.
- Copy: `matches.requests.sentTitle`, `matches.requests.sentEmpty`, `matches.requests.cancel`.

**Acceptance:** request to join two approval-gated matches; both appear under "Requests you sent"; the tab badge does not move; Cancel removes one and the host gets `match_request_withdrawn`.

### 1c. A full match's requests are a waitlist, and Approve says so

- `apps/mobile/app/match/[id]/index.tsx` — when `hub.participant_count >= hub.capacity`, title the section `matches.hub.waitlist` and pass `disabled` to the Approve button; Reject stays live.
- Route `respondMutation.onError` through `joinErrorKey` so `match_full` renders `matches.hub.joinFull` instead of the generic `matches.hub.respondError`.
- Copy: `matches.hub.waitlist`, `matches.hub.waitlistHint`.

**Acceptance:** fill a match holding a pending request — the section reads Waitlist, Approve is disabled, Reject works.

### 1d. Declined stops sharing a glyph with Waiting

`TONE_ICONS` maps both `neutral` and `info` to the `info` icon (`SemanticBadge.tsx:10`), so the two opposite states in the Invited section look alike.

- `apps/mobile/app/match/[id]/index.tsx` — Declined uses tone `critical`.
- Verify the `critical` pair against WCAG AA on the card background per the `tennis-ux-audit` checklist.

**Verification for Phase 1:** `pnpm lint`, `pnpm typecheck`, `pnpm test`.

---

## Phase 2 — `098_cancel_match_invite.sql`

Self-contained; depends on nothing in Phase 3.

**Migration**

- `cancel_match_invite(p_match_id uuid, p_invited_user_id uuid)` — `security definer`, `set search_path = ''`. Caller must be the invitation's `created_by` or the match's `creator_id`. Sets `revoked_at = now()`, leaves `declined_at` and (later) `superseded_at` null. Raises `P0002` when nothing matches. `revoke all from public, anon` / `grant execute to authenticated` — `validate-migrations.mjs` fails a newly introduced definer function without an explicit grant.
- `create_match_invite` — restore the `m.status in ('draft','open','full')` guard raising `match_not_invitable`, which `021` had and `044` dropped when it added the rate limit (carried forward by `086` and `088`). Add a capacity guard. Cap pending targeted invitations at **open seats + 2**, raising `invite_cap_reached`.

**Client**

- `packages/api/src/matches.ts` — `cancelMatchInvite` wrapper.
- `apps/mobile/app/match/[id]/index.tsx` — destructive trailing action on each pending row of the Invited section; no confirm dialog; invalidate `["match-hub", id]`.
- `apps/mobile/src/lib/invite-link.ts` — map `invite_cap_reached` to its own copy alongside `invite_rate_limited`.
- Copy: `matches.hub.cancelInvite`, `matches.invite.capReached`.

**pgTAP** `supabase/tests/database/098_cancel_match_invite_test.sql`

- inviter can cancel their own; match creator can cancel an invite created by another participant; a third party cannot
- a cancelled invite leaves `declined_at` null, so `invited_players` does not report it as a decline
- cancelling twice raises
- invite on a `completed` / `cancelled` / `booking_pending` match raises `match_not_invitable`
- invite beyond open seats + 2 raises `invite_cap_reached`

**Acceptance:** the host can withdraw an offer from the hub; the invitee's inbox row disappears; the hub's Invited section no longer lists them; no notification is sent.

---

## Phase 3 — `099_invitation_supersede.sql`

The core change. One branch, no client behaviour beyond the new notification copy.

**Schema**

```sql
alter table public.match_invitations add column superseded_at timestamptz;
```

**Functions**

- `supersede_pending_invites(p_match_id uuid)` — stamps `superseded_at` on invitations that are targeted, unaccepted, unrevoked, undeclined and not already superseded. **No `p_except_invitation_id`:** `apply_match_invitation_acceptance` stamps `accepted_at` before it refreshes state, so `accepted_at is null` already excludes the accepting invitation.
- `restore_superseded_invites(p_match_id uuid)` — clears `superseded_at` only where the invitation is still genuinely acceptable: `expires_at > now()`, unaccepted, unrevoked, undeclined, and the match has a time option with `withdrawn_at is null and ends_at > now()`. Enqueues `match_seat_reopened` per restored invitee, keyed `match_seat_reopened:{invitation_id}:{15-min bucket}`.
- `refresh_match_open_state` — after it writes the new status, call `supersede_pending_invites` when `count >= capacity` and `restore_superseded_invites` when `count < capacity`. This is the whole fix for the path-A/path-B divergence: every join, leave, accept, withdraw and booking path already goes through here.
- `apply_match_invitation_acceptance` — delete the trailing `v_count_after` block and the `revoke_pending_targeted_invites` call.
- `drop function public.revoke_pending_targeted_invites(uuid, uuid);`
- `list_my_match_invites` — add `superseded_at is null` and require a future time option, which closes the invite that renders with a null `soonest_time` and then fails `assert_joinable_match` behind the generic accept error.
- `notify_invitation_superseded` — enqueues `match_invitation_superseded` with `deepLink: '/discover'`, keyed `match_invitation_superseded:{invitation_id}`. Called from `supersede_pending_invites`.

**Trigger** `matches_close_pending_asks` — `after update on public.matches`, sibling to `matches_notify_cancelled` (`089`) rather than an edit to it, since that one is about notification and this is about state. When `new.status` leaves `('draft','open','full','ready_to_book')` and `old.status` did not:

- revoke every pending or superseded invitation on the match
- set every `requested` participant row to `declined`, which fires the existing `requested → declined` branch of `notify_match_roster_change` and therefore the existing `match_request_declined` kind — no new kind for the waitlist

**Notification copy — four files, guarded by `notification-copy-parity.test.ts`**

- `packages/domain/src/notifications.ts` — add both kinds to `NOTIFICATION_KINDS`
- `packages/i18n/src/locales/{en,ar,fr}.json` — `notifications.kinds.*`
- `supabase/functions/_shared/notification-copy.ts` — same two kinds, byte-identical

`matches.` and `notifications.` are both `CRITICAL_FLOW_KEY_PREFIXES`, so Arabic and French need **real translations**; `locales.test.ts` checks for Arabic script and stale-copy markers, not just key presence.

**pgTAP** `supabase/tests/database/099_invitation_supersede_test.sql` — the scenario matrix, which is the point of the whole change:

| Case                                             | Assertion                                                  |
| ------------------------------------------------ | ---------------------------------------------------------- |
| singles, 3 invited, one accepts                  | other two `superseded_at` set, `revoked_at` null           |
| **same, but the seat is filled by `join_match`** | **identical result** — this is the bug                     |
| a participant leaves after either fill           | both restore identically, `superseded_at` null             |
| restore skips an expired invitation              | stays superseded                                           |
| restore skips a match with no future time option | stays superseded, and stays out of `list_my_match_invites` |
| restore skips a declined and a withdrawn invite  | `declined_at` / `revoked_at` survive untouched             |
| leaver's own invites                             | stay `revoked_at` — not restored                           |
| doubles fills one seat at a time                 | supersede fires once, at capacity, not on the first join   |
| match moves to `booking_pending`                 | invitations revoked, `requested` rows declined             |
| flexible timing reaching `ready_to_book`         | superseded, since that status implies a full roster        |
| suspend/restore inside 15 minutes                | one notification of each kind, per the dedup bucket        |

**Acceptance:** a superseded player gets one "that match filled up" pointing at Discover; when a seat reopens they get one "a spot opened" pointing at the match and the invite is back in their inbox; both fill paths behave the same.

---

## Phase 4 — `100_hub_invite_truth.sql`

`get_match_hub` only. Needs `superseded_at`, so it follows Phase 3.

- `invited_players` — exclude invitees holding a live participant row (`accepted`, `requested`), so somebody who was invited and then asked to join stops appearing in two sections; keep only the newest invitation per `invited_user_id` (`distinct on`), so a decline followed by a re-invite stops appearing twice in one section; report `superseded` as a third status.
- `invited_players` is returned to the **creator only**, but `viewerMayInvite` lets any accepted participant reach the invite screen — deliberately, it is what lets somebody who joined a doubles match find the fourth. So a non-creator inviter still sees an empty list and can still be offered a second invite to somebody they already asked. Return each participant the invitations **they** created, alongside the full list for the host. Found while wiring Phase 1a, which fixes this for the host and only the host.
- `next_action` — add a `request_pending` branch for `v_participant_status = 'requested'`, above the `view_match` fallback. `next_action` is `text`, so no type change.

**Client**

- `apps/mobile/app/match/[id]/index.tsx` — render `superseded` as "On hold — match full" with tone `neutral`; handle `request_pending` in the CTA resolver.
- `apps/mobile/src/lib/invite-player-state.ts` — add the `superseded` state.
- Copy: `matches.hub.invitedOnHold`, `matches.hub.nextAction.requestPending`.

**pgTAP** `supabase/tests/database/100_hub_invite_truth_test.sql` — the two duplicate cases, the `superseded` status, `request_pending`, and that a non-creator still sees neither list (the `093` rule).

---

## Phase 5 — Verification and docs

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm db:validate
```

```bash
pnpm db:reset && pnpm db:test && pnpm db:types
```

`pnpm db:types` regenerates `packages/types/src/database.ts` for the new column and RPCs — commit it with the migration.

**Docs to update alongside:**

- `docs/FLOWS_AND_SCREENS.md` — the Invites segment's second group; the hub's Waitlist and Invited sections
- `docs/LIFECYCLE.md` — the invitation state table above
- `docs/DATABASE.md` — `superseded_at`, `cancel_match_invite`, the trigger
- `docs/TESTING_SECURITY.md` — the invite cap beside the existing 20/day rate limit

**Manual rehearsal** (two devices, per `PHASE_0_MANUAL_REHEARSAL_GUIDE.md`): host invites three to a singles match → one accepts → confirm the other two get the suspended notice and the inbox clears → the joiner leaves → confirm both invites return with a notification → host withdraws one from the hub → confirm it leaves that player's inbox silently.

Push delivery needs the Vault secrets from `060`, so the notification halves must be checked on **staging**, not locally — `invoke_process_notifications` is a no-op without them and an empty notification centre is the correct local result.

## Found while building

- **The seed suite rots with the clock.** `007_matches_test` began failing mid-Phase-3 with `match_not_joinable` where it expected `42501`. Cause: seeded matches `d6666666` / `d7777777` carry fixed time options (2026-09-05), `pg_cron` is installed, and the `018` expiry sweep had marked them `expired` eight days on. Nothing to do with the migration — `pnpm db:reset` cleared it. Worth making the seed's time options relative to `now()` so the suite stops depending on how long the local database has been up.
- **`ready_to_book` always implies a full roster**, confirmed live. This is why the model needs no separate booking-time rule, and why suspension sits above the timing-mode branching rather than inside either arm.

## Out of scope, recorded deliberately

- **Removing a player from a match.** `participant_status` has carried an unwritten `'removed'` value since `001`. Building it needs three product decisions that have not been made — whether removal touches the `029` reliability record, how the removed player is told, and what the rest of the roster sees. See the 2026-09-13 DECISIONS entry. Count how often hosts cancel a whole match to eject one player during cohort A; that frequency is the argument.
- **Waitlists on instant-join matches.** A host who chose instant join chose not to make decisions about people. A reopened seat returns the match to `open` and it is discoverable again immediately, which is that match type's own re-fill mechanism.
- **Prefilling Discover from the superseded notification.** `NotificationParams` carries no zone or level fields; adding them touches every enqueue site. The deep link goes to `/discover` unfiltered for now.
