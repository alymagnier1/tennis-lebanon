# Cohort A Rehearsal Fixes

Findings from the Phase 0.3 manual rehearsal. Ordered so that everything needing no migration lands first.

**Related:** [`COHORT_A_REHEARSAL_FINDINGS.md`](COHORT_A_REHEARSAL_FINDINGS.md) (raw findings) · [`PHASE_0_MANUAL_REHEARSAL_GUIDE.md`](PHASE_0_MANUAL_REHEARSAL_GUIDE.md) (rehearsal script) · [`CHAT_AUDITS_INDEX.md`](CHAT_AUDITS_INDEX.md) (all chat audits)

Pair with [`PILOT_50_PLAYER_LAUNCH.md`](PILOT_50_PLAYER_LAUNCH.md) Phase 0 and [`PILOT_OPERATIONS.md`](PILOT_OPERATIONS.md) § "Four workflow rehearsals".

## Progress

| Item                                          | Status              |
| --------------------------------------------- | ------------------- |
| 1a — join success vs request sent             | Done (`9fb5167`)    |
| 1b — pending request on match cards           | Done (`9fb5167`)    |
| 1c — explain club requirement in create flow  | Done (`9fb5167`)    |
| 1d — zone/club honesty warning                | Done (uncommitted)  |
| 2 — cancellation notification + in-app reason | Done (uncommitted)  |
| 3 — optional Home join-request next action    | Dropped — see below |
| 4 — DECISIONS entry                           | Done (uncommitted)  |

Two of the eight original findings need **no code change** and are recorded here so they are not re-investigated:

- **Host got no push or toast when someone joined.** Not a bug. All five roster kinds (`match_join_request`, `match_request_accepted`, `match_request_declined`, `match_participant_joined`, `match_participant_left`) fire from the `match_participants_notify_roster` trigger. But `listUserNotifications` filters `.not("sent_at", "is", null)`, and locally nothing sets `sent_at` because the Vault secrets in [`supabase/migrations/060_process_notifications_invoker.sql`](../supabase/migrations/060_process_notifications_invoker.sql) are absent, so `invoke_process_notifications` is a no-op. No push, no bell badge and an empty notification centre are all the correct local result. Verify on staging per [`STAGING_CHECKLIST.md`](STAGING_CHECKLIST.md) section 7b.
- **Club requirement differs between the `+` button and Ask to play.** Intended. [`packages/domain/src/matches.ts`](../packages/domain/src/matches.ts) requires a club only for `visibility === "public"`; Ask to play creates `invite_only`. Phase 1c makes the rule visible rather than changing it.

---

## Phase 1 — Client-only fixes, no migration

### 1a. "You joined this match" on a request

`join_match` already returns `public.participant_status`, and `joinMatch` in [`packages/api/src/matches.ts`](../packages/api/src/matches.ts) returns it as `Promise<string>`. The hub previously threw it away and always showed `matches.hub.joinSuccess`.

Branch on the resolved value. This is the only call site that invokes `joinMatch` — Discover, Home and `hub-action-bar` only render pre-join labels.

- Add `matches.hub.requestSentSuccess` to en, ar and fr
- Keep `joinSuccess` for the `accepted` path

### 1b. "Waiting for players" while a request is pending

`list_my_matches` already returns `participant_status` and includes `requested` rows (`mp.status in ('accepted', 'requested', 'invited')`). `matchListAction` never received it, so a requester fell into the open-non-creator branch.

- [`apps/mobile/src/lib/match-list-card.ts`](../apps/mobile/src/lib/match-list-card.ts): add `participantStatus?: string` to the `matchListAction` input and return early for `"requested"`
- Pass `match.participant_status` at the two render sites: [`apps/mobile/app/(tabs)/matches.tsx`](<../apps/mobile/app/(tabs)/matches.tsx>) and [`apps/mobile/src/components/home/HomeDashboard.tsx`](../apps/mobile/src/components/home/HomeDashboard.tsx)
- Add `matches.list.action.requestSent` to three locales
- Leave the `statusLabel` pill alone. It reads `matches.status.open`, which is true about the match; the action pill is the viewer-relative one and the one that misled.

### 1c. Explain the club rule instead of changing it

Three i18n keys already exist in all three bundles and were wired to nothing: `preferredClubsRequiredHelp`, `preferredClubsOptionalHelp`, `listOnDiscoverHint`.

In [`apps/mobile/app/match/create/schedule.tsx`](../apps/mobile/app/match/create/schedule.tsx):

- Swap the fixed `preferredClubsListingOnly` helper for the required/optional pair, keyed on the existing `clubsRequired` derived value
- Add `description={t("matches.create.listOnDiscoverHint")}` to the `SettingToggle` for list-on-Discover

No new i18n keys.

### 1d. Zones that contain none of the chosen clubs

`zoneIds` has `min(1)` and no maximum; `preferredClubIds` caps at 3. A host can advertise three zones with every club in one. `ClubDirectoryRow` carries `zone_id`, so this is computable client-side.

- Add a helper beside `matchCardAreaLabel` in [`apps/mobile/src/lib/match-clubs.ts`](../apps/mobile/src/lib/match-clubs.ts) returning selected zones with no chosen club
- Surface it as an inline notice in the Where panel of `schedule.tsx`, after the club picker

Warn at creation rather than narrowing the zone list on cards. Narrowing would silently rewrite what a host chose and would also change how already-published matches read.

---

## Phase 2 — Cancellation reaches the other player

The worst finding. `cancel_match` (current definition in [`supabase/migrations/030_match_lifecycle_hardening.sql`](../supabase/migrations/030_match_lifecycle_hardening.sql)) requires a reason once a match is full, writes it to `matches.cancellation_reason`, and stops there. No notification kind exists for cancellation, `get_match_hub` does not return the column, and `list_my_matches` excludes cancelled matches entirely. The host is compelled to explain themselves to nobody.

### 2a. New migration

Enqueue from a **trigger on `matches`**, not from inside `cancel_match`. Both `cancel_match` and `withdraw_from_booked_match` (in [`supabase/migrations/034_court_and_exit_paths.sql`](../supabase/migrations/034_court_and_exit_paths.sql)) can set `status = 'cancelled'`, and the 2026-08-21 decision chose triggers over RPC edits for exactly this reason. Follow the shape of [`supabase/migrations/076_notify_join_request.sql`](../supabase/migrations/076_notify_join_request.sql):

- Fire on `old.status <> 'cancelled' and new.status = 'cancelled'`
- Fan out with `notify_match_participants(match_id, 'match_cancelled', v_actor_id, ...)` so the person who cancelled is excluded
- Reuse the 15-minute dedup bucket
- Deep link `/match/{id}`, which `resolveNotificationHref` already handles
- Add `cancellation_reason` to the `match_hub_card` composite type and assign it in `get_match_hub`

### 2b. Register the kind in four places

- `NOTIFICATION_KINDS` in [`packages/domain/src/notifications.ts`](../packages/domain/src/notifications.ts)
- `notifications.kinds.match_cancelled` in en, ar and fr
- `NOTIFICATION_COPY` in [`supabase/functions/_shared/notification-copy.ts`](../supabase/functions/_shared/notification-copy.ts)

`notification-copy-parity.test.ts` asserts byte-identical copy across the i18n bundle and the Edge Function table, so these must match exactly.

**Recommended deviation from the brief.** Keep the reason out of the push payload and put a generic body there ("Open the match to see why"), showing the reason in-app instead. Reasons: `NotificationParams` carries only `name`, `clubName`, `startsAt` and `spotsLeft`, and every existing kind uses structured params rather than free text, so adding a `{{reason}}` placeholder means changing the type plus all three parsers; a user-authored string cannot be localized and would transit Expo's servers. The reason still reaches the player, one tap later.

### 2c. Show it

- `MatchHubCard` in [`packages/api/src/matches.ts`](../packages/api/src/matches.ts) gains the field
- Add a `cancelled` branch to `primaryBannerBody` in [`apps/mobile/app/match/[id]/index.tsx`](../apps/mobile/app/match/[id]/index.tsx)

Note the path back: `exitMatchHub()` runs after a cancel and `list_my_matches` filters cancelled matches out, so the hub is unreachable from the Matches tab. The durable route is the notification centre row, which persists and deep-links to the hub. `get_match_hub` still authorises a participant whose row stayed `accepted`, so the link resolves. Not changing the `list_my_matches` filter.

---

## Phase 3 — Optional: pending requests on Home

Largest piece, and separable. A `joinRequest` next-action kind would put "someone asked to join" on the Home carousel instead of only inside that match's hub.

Blocked on data: `MyMatchRow` has no pending-request count; only `MatchHubCard` exposes `pending_requests`. Needs a migration extending `list_my_matches`, plus the standard nine files a new kind touches — `home-next-actions.ts`, `match-status-tone.ts` (tone and label), `routes.ts`, `HomeNextActionCard.tsx` icons, three locale bundles, and two test files.

Drop this if Phase 2 runs long. The host already sees requests in the hub and gets a push once staging delivery is configured.

---

## Phase 4 — Records

- [`docs/DECISIONS.md`](DECISIONS.md) entry dated 2026-08-27 covering the cancellation notification, the trigger-over-RPC choice, the generic-push decision and its alternative, and the two client-side join fixes
- Tick 0.3 and 0.4 in the Phase 0 table of [`PILOT_50_PLAYER_LAUNCH.md`](PILOT_50_PLAYER_LAUNCH.md) once these land
- The 2026-08-21 decision already records a related open gap: **a player removed by the host is still never told**, because `match_participant_left` excludes the removed player. Same shape, same trigger. Not in scope here; flag it in the new entry so it stays visible.

---

## Verification

- `pnpm db:test` for the new pgTAP file, following `076_notify_join_request_test.sql`: the other participant is notified, the canceller is not, repeats collapse
- `pnpm verify:pilot` for lint, types, unit tests, migration checks and Prettier
- `notification-copy-parity.test.ts` must pass, which is what catches a kind registered in three places instead of four
- Re-run rehearsal workflows 1 and 2 on a fresh `pnpm db:reset`
