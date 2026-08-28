# Cohort A rehearsal findings

**Date:** 2026-08-27  
**Source:** Manual Phase 0.3 walkthrough (founder notes from chat)  
**Fix plan:** [`COHORT_A_REHEARSAL_FIXES.md`](COHORT_A_REHEARSAL_FIXES.md)

Nineteen findings from walking the app with two seeded players. Ordered by severity in the fix plan. Findings 9-11 came from a second pass on 2026-08-28, and 12-15 from a third the same day, each after the previous round of fixes landed.

---

## 1. Club requirement differs by entry path

**Observed:** Normal match creation through the `+` button requires picking preferred clubs. Creating through **Ask to play** on a Discover card allows creating without preferred clubs.

**Resolution:** Intended behaviour — public matches require clubs; Ask to play creates `invite_only`. Phase 1c explains the rule in UI rather than changing it. See fix plan.

---

## 2. Join request — wrong status on match card

**Observed:** After sending a join request and before acceptance, the match appears in Active matches with **"Waiting for players"** status. Should read **"Pending request"** or similar.

**Resolution:** Phase 1b — thread `participant_status` into `matchListAction`; show `matches.list.action.requestSent`. Status pill stays `matches.status.open` (true about the match); action pill is viewer-relative.

**Status:** Done (`9fb5167`).

---

## 3. Join request — wrong success dialogue

**Observed:** User sees dialogue implying **"You joined this match"** when they only sent a request.

**Resolution:** Phase 1a — branch `joinMutation.onSuccess` on returned `participantStatus`; `requestSentSuccess` vs `joinSuccess`.

**Status:** Done (`9fb5167`).

---

## 4. Join request — joiner not told when host accepts

**Observed:** User should know when host accepts their join request.

**Resolution:** Existing notification kinds (`match_request_accepted`) fire via trigger; verify on staging where `sent_at` is set. In-app notification centre is the durable route locally push may not fire (Vault secrets absent in local dev).

---

## 5. Join request — host alert missing locally

**Observed:** Host receives notification UI inside match hub but **no toast** on Home; didn't receive push locally.

**Resolution:** **Not a bug locally.** All five roster kinds fire from `match_participants_notify_roster`. In-app list filters `sent_at IS NOT NULL`; locally nothing sets `sent_at` (migration `060` Vault secrets absent). Empty notification centre is expected locally. Verify on staging per `STAGING_CHECKLIST.md` §7b.

---

## 6. Cancellation note invisible to other player

**Observed:** When host cancels a match with a note, where does the other player see it?

**Resolution:** Phase 2 — worst finding. `cancel_match` writes `cancellation_reason` but no notification kind, hub RPC doesn't return it, cancelled matches excluded from `list_my_matches`. New migration + `match_cancelled` notification + hub banner.

---

## 7. Zones vs clubs honesty

**Observed:** User can pick multiple zones in create flow while chosen clubs exist in only one of those zones. Misleading on match cards.

**Resolution:** Phase 1d — client-side helper in `match-clubs.ts`; inline notice in create Where panel. Warn at creation; don't silently narrow zones on published cards.

---

## 8. Host alert design question (open product question)

**Observed:** When a player joins, how should the host be alerted — notification, toast on Home, or both?

**Resolution:** Deferred to staging verification. Hub already shows pending requests; push + notification centre intended once delivery configured. Optional Phase 3: `joinRequest` Home next-action kind (needs `list_my_matches` extension).

---

## 9. "Request to join" on a Discover card opens the hub instead of sending

**Observed:** Tapping the action button on an open match card navigates to the match hub rather than joining or sending the request.

**Resolution:** `discover.tsx` passed `actionLabel` but never `onActionPress`, and `FigmaMatchCard` falls back to `onActionPress ?? onPress` — so the button inherited the card's navigate handler. Split by case: an instant join now happens in place; an approval-gated match still opens the hub, because that is where the join note from `088` is written, and its label is now `requestJoinOpens` ("Request to join…") so it promises a screen rather than a send. Fixed.

---

## 10. Nothing stops a player being in two matches at the same hour

**Observed:** The same time and venue can be used for more than one match.

**Resolution:** There was no time-conflict rule anywhere — `hosted_match_cap` counts hosted matches and stops at three, and `032_discovery_overlap` is about availability in discovery. The gap was wider than reported: a player could also **join** several matches that overlap each other, which is a no-show waiting to happen.

Migration `090` blocks joining an hour already agreed to, and adds `viewer_agreed_time_conflicts` so the client can warn before the RPC refuses. Venue is deliberately not part of the rule: two hosts wanting courts at the same club at the same hour is ordinary demand, and the booking overlap constraint already protects the court itself. Time alone is the invariant.

Hosting is warned about rather than blocked, and only **agreed** times count — a host offering the same three evenings across two listings is recruiting, not double-booking. See the 2026-08-28 decision. Fixed for joining; the create-side warning is still to build.

---

## 11. A host cannot see join requests without opening each match

**Observed:** The only way to find out somebody asked to join is to open that specific match's hub.

**Resolution:** Same finding as 8, hit again on a second pass, which is the evidence that settles it. `pending_requests` was returned by `get_match_hub` and nowhere else. Migration `091` adds `pending_request_count` to `list_my_matches` beside the existing `unread_message_count`, and the Matches tab badges it with the pattern already shipped for unread chat — rather than the new Home next-action kind the fix plan had scoped, which was a migration plus nine files. Counted for the creator only: nobody else can accept or decline. Fixed.

---

## 12. A requester shows as "Invited" on the host's invite screen

**Observed:** After a player sends a join request, the host's invite screen labels them **Invited**.

**Resolution:** `isAlreadyInMatch` collapsed `accepted`, `invited` and `requested` into one state and `playerInviteState` returned only two, so a player who had asked _you_ read as one you had asked — and the row most needing an answer looked like one already dealt with. Now four states through `invite-player-state.ts`, with `requested` tappable and routing to the hub where accept and decline live. Fixed.

---

## 13. A join request cannot be taken back

**Observed:** After sending a request, there is no way to cancel it.

**Resolution:** `leave_match` requires `status = 'accepted'` and otherwise raises "Not an active participant"; nothing covered a `requested` row. Migration `092` adds `withdraw_join_request`, setting the row to `left` — never `declined`, which records the host's answer — and telling the host through a new `match_request_withdrawn` kind. Surfaced as a destructive link on the hub. `left` already reactivates on rejoin, so asking again works. Fixed.

---

## 14. No notification when a host declines a request

**Observed:** The requester hears nothing when their request is declined.

**Resolution:** **Not a missing notification.** Verified against the database: `077` enqueues `match_request_declined` to the requester, correctly addressed. It did not appear because the notification centre filtered `sent_at is not null`, and nothing sets `sent_at` locally — the same root cause as finding 5.

But the filter was wrong beyond local dev: in production a failed push, a stale token or notifications switched off would leave the centre empty too, so the one screen that exists to recover a missed message was gated on having received it. Both the list and the unread badge now gate on `scheduled_at <= now()`. See the 2026-08-28 decision. Fixed.

---

## 15. Inviting a player also opens the share sheet

**Observed:** The invite button sends the invitation and opens a share box at the same time.

**Resolution:** `inviteMutation.onSuccess` called `shareMatchInvite` alongside the toast, and that was the only call site — so the only way to get a shareable link was to send a targeted invite to a named player. Two intents fused: a targeted invite already reaches that player by push, while a link is for someone not on Tennis Lebanon at all. `create_match_invite` has always accepted a null recipient, so the split was client-side only. Fixed.

---

## 16. `in_progress` has an instruction where every other status has a state

**Observed:** Walking workflow 3, the match header read **"Confirm you played"** — before confirming, after confirming, and after a full reload.

**Resolution:** Not a stale render. `matches.status.in_progress` is literally `"Confirm you played"`, while every sibling in that map is a state: Draft, Open for players, Full, Ready to book, Confirmed, Completed, Cancelled, Expired. The one imperative in a list of nouns.

Match status is viewer-independent; "confirm you played" is viewer-relative. So it keeps telling a player to do a thing they have already done, and it renders on seven surfaces — Home, Discover, the Matches tab, invites and the hub — meaning a stranger browsing Discover can be told to confirm a match they are not in. All three locales carry the imperative.

This is the same conflation as finding 2, which was fixed by separating the status pill from the viewer-relative action pill. The pills were separated; this copy was not.

**Recommended:** `"In progress"`, matching the shape of its siblings. The instruction already exists where it belongs — the result panel's own prompt, and `matches.list.action.confirmPlayed` on the action pill.

---

## 17. The join-request card button still navigated (finding 9, reopened)

**Observed:** After finding 9 was fixed, "Request to join" on a Discover card still opened the match hub.

**Resolution:** The first fix was too conservative. It made instant joins act in place but deliberately kept navigation for approval-gated matches, because the hub is where the join note from `088` is written, and relabelled the button "Request to join…" to promise a screen. That preserved the note at the cost of the thing the button says it does — and it was reported again, which settles it.

Both kinds now act in place. **The note is the cost, taken deliberately:** `join_match` has always treated it as optional and the hub still collects one for anyone who opens the match before asking, but the card is the common path, so most requests will now arrive with no reason attached. If hosts start declining requests they cannot judge, the note needs a sheet on the button rather than a screen behind it. Worth watching in cohort A.

---

## 18. A host cannot see who they invited

**Observed:** After inviting players, the match hub shows an open match with no sign of who was invited — pending, declined or otherwise.

**Cause, in three parts:**

1. `pickHubVsSides` builds the hero from `acceptedHubParticipants`, which filters `status === "accepted"`. Invited and requested players are dropped.
2. `MatchHubParticipants` — the one component that _does_ render a status label per player — only renders when `!vsHeroStage`, and `HUB_VS_HERO_STATUSES` covers `open`, `full`, `ready_to_book`, `booking_pending`, `confirmed` and `in_progress`. So for every live match the roster is the hero, and the list that would answer the question is hidden.
3. `get_match_hub` returns participants with `status in ('accepted','requested','invited')`. **`declined` is not among them**, so "did they say no?" cannot be answered anywhere in the app, at any layer.

The host sees an open slot and no way to tell it apart from one nobody was ever asked to fill — so the rational move is to invite the same people again.

**Fixed**, and the cause was deeper than the three parts above. Two schema facts had to be dealt with first:

- **An invite is not a participant.** `create_match_invite` writes to `match_invitations`; no `match_participants` row exists until the invite is accepted. Any fix reading the roster to answer "who did I invite" reads the wrong table.
- **A decline was indistinguishable from a withdrawal.** `decline_match_invitation` set `revoked_at`, and so does the host's own `revoke_pending_targeted_invites`. One column recorded two opposite events, so "did they say no?" was not unexposed — it was never recorded.

Migration `093` adds `declined_at`, sets it when the player refuses, and adds a host-only `invited_players` to the hub card carrying pending invitations and declines. Invitations revoked before this migration keep a null `declined_at` and read as withdrawals, which is the safer reading — claiming somebody declined when they may not have is worse than staying quiet.

Host-only, matching the 2026-08-21 call on pending requests: a decline is the inviter's business, not the roster's.

---

## 19. The report screen offers a single choice as checkboxes

**Observed:** Walking workflow 4, the six report categories expose themselves to assistive technology as checkboxes.

**Cause:** `Choice` in `FormUi.tsx` sets `accessibilityRole="checkbox"` with `accessibilityState={{ checked }}`. The report screen uses it for a mutually exclusive choice — `selected={category === value}` with `onPress={() => setCategory(value)}` — so picking one silently clears another.

A screen-reader user is told they may select several and finds their previous answer gone. The correct semantics are `radio` inside a `radiogroup`. `Choice` has exactly one call site, so the fix is contained, and it lands on the safety path, which is the flow where a confused reporter matters most.

**Fixed.** `Choice` now announces `radio` by default and takes a `multiple` prop for the sets where several answers really are allowed — so a future multi-select caller has to say so rather than inheriting the wrong role silently. `accessibilityState` carries both `checked` and `selected`, since assistive technologies differ on which they read for a radio. The category set is wrapped in a `radiogroup` with its own label, so it is announced as one question rather than six loose controls. Regression tests in `FormUi.native.test.tsx` cover both roles and the checked state.


## Summary table

| #   | Finding                                     | Severity       | Fix phase      | Status           |
| --- | ------------------------------------------- | -------------- | -------------- | ---------------- |
| 1   | Club rule differs + vs Ask to play          | UX confusion   | 1c explain     | Done             |
| 2   | "Waiting for players" while request pending | P1             | 1b             | Done             |
| 3   | "You joined" on request sent                | P1             | 1a             | Done             |
| 4   | Joiner not notified on accept               | P1             | Staging verify | Open             |
| 5   | Host no push/toast locally                  | Expected local | Staging verify | Documented       |
| 6   | Cancellation reason dead-end                | P0             | 2              | Done             |
| 7   | Multi-zone / single-club mismatch           | P2             | 1d             | Done             |
| 8   | Host alert UX pattern                       | Design         | 3 optional     | Superseded by 11 |
| 9   | Card action navigates instead of joining    | P1             | —              | Done             |
| 10  | No time-conflict rule on join or host       | P0             | `090`          | Done (join)      |
| 11  | Join requests invisible outside the hub     | P1             | `091`          | Done             |
