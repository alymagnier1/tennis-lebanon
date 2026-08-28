# Cohort A rehearsal findings

**Date:** 2026-08-27  
**Source:** Manual Phase 0.3 walkthrough (founder notes from chat)  
**Fix plan:** [`COHORT_A_REHEARSAL_FIXES.md`](COHORT_A_REHEARSAL_FIXES.md)

Eleven findings from walking the app with two seeded players. Ordered by severity in the fix plan. Findings 9-11 came from a second pass on 2026-08-28, after the first round of fixes landed.

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
