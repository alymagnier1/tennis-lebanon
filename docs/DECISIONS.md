# Architecture and Product Decisions

Record decisions using this template:

## YYYY-MM-DD — Decision title

- Status: proposed | accepted | superseded
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Owner:

## 2026-08-17 — Every Discover toggle narrows when on, including Area

- Status: accepted
- Context: the Area chip never filtered anything, in either position, and it took two separate faults to achieve that. First, `resolveDiscoverFiltersFromProfile` mapped `matchArea: true` to `zoneIds: undefined`, and `discover_compatible_players` treats a null `p_zone_ids` as **no zone filter** — the viewer's own zones are resolved separately and feed only the `zone_overlap` display flag, never the `where` clause. Second, the sole caller passed `allZoneIds` from `getActiveZones`, which is every active zone in the country (four of them), so the `false` branch restricted to all zones and matched everyone too. `matchLevel`, `matchIntent` and `matchAvailability` all narrow when on; this one did nothing either way, while `activeFilterCount` displayed it as an active filter. The knock-on symptom was worse than the chip itself: `relaxFilters` — the "Show everyone" button on the empty state — clears all four toggles, so the control whose entire purpose is widening the search was routed through the branch that was supposed to restrict. The pre-existing test froze the mapping in place while its own name gave away the intent: "widens level, area, intent, and availability when toggles are off", asserting `zoneIds: ["zone-a", "zone-b"]`.
- Decision: `matchArea` now narrows when true, like the other three: `matchArea && ownZoneIds?.length ? ownZoneIds : undefined`. The screen feeds it `listOwnPreferredZoneIds` — the player's own zones — instead of the country's zone directory, and the parameter is renamed `allZoneIds` → `ownZoneIds`, since the old name is what invited the mistake. `DEFAULT_DISCOVER_MATCH_TOGGLES.matchArea` flips to **false**, and the persisted-filter storage key is bumped to `v2`. Separately, `formatDiscoverResultsLabel` took the "near you" wording unconditionally — so the header read "8 players found near you" over a list including other areas — and now takes `nearbyOnly`, read off `resolvedFilters.zoneIds !== undefined` so the wording cannot drift from what was sent to the RPC. The unsuffixed keys already existed, translated, in all three locales and were simply never reached.
- Alternatives considered: renaming the toggle to something like "All areas" so the existing mapping became truthful (rejected — it would be the only toggle that widens when on, and it would not have fixed the data source, so the chip would still have done nothing); fixing the mapping but keeping the `true` default (rejected — combined with the corrected data source it would silently shrink every pilot player's Discover results at exactly the density where an empty room does the most damage); migrating the persisted value (rejected — a stored `true` was recorded when the flag was inert, so it carries no intent worth translating; the old key is left to expire); deriving `nearbyOnly` from the toggle rather than the resolved filters (rejected — that is the same class of mistake, trusting the control instead of the query).
- Consequences: the default result set is unchanged in size — it was already effectively unrestricted, so nothing narrows for existing players — but the chip now reports that honestly, and `filters_active` in `discover_viewed` drops from 2 to 1 for a default session, which is the truthful count. Verified live for Player A (pilot-north + pilot-central): off gives "8 players found" across all three zones, on gives "6 players found near you" with pilot-south correctly gone. A player who has set no zones still cannot be restricted to nothing. **Separately noted, not changed:** `matchLevel` does not filter either. Migration `040` computes `level_fit` as a flag and never filters on it, and `filteredPlayers` in `discover.tsx` filters only by search text, so the level chip affects the "Similar level" hint and sort order rather than the result set. Both this audit and Cursor's assumed level was a filter, and the plan's "loosen Discover defaults" was written on that assumption. Whether level _should_ filter is a product decision rather than a bug, so it is left as it stands and recorded here. Also unresolved: the four filter chips set `accessibilityState={{ selected }}`, which react-native-web does not emit for `role="button"`, so a screen reader cannot tell which filters are on — the same gap the "I'm free" chips solved by putting state in the label.
- Owner: Founder

## 2026-08-17 — The liquidity signal is a SQL aggregate, and it counts blocks rather than people

- Status: accepted
- Context: the ping writes intent, and on its own that is a diary entry — a player declares a free Thursday, nothing happens, and the lesson learned is that declaring is pointless. The read half answers the question the ping cannot ("is anyone else free then?"), which is what makes declaring worth doing. This also **reverses the deferral** in the entry below, which put off showing a count on the grounds that "a number invites the question of who". That reasoning applied to feedback on your own ping; it does not apply to demand across the week, which is the only mechanic in the plan that _creates_ demand rather than servicing it.
- Decision: a new `get_availability_liquidity(p_horizon_days, p_zone_ids)` RPC (`074`) returning one row per upcoming block as `(starts_at, ends_at, player_count)`. Home shows the count on each "I'm free" chip whose block has demand, and lists the two busiest blocks the chips cannot reach under "Most players free this week", each tappable to ping that block. Ranked by count first, not by soonest — "Thursday is when everyone plays" is the insight, and the soonest block is already a chip.
- Alternatives considered: counting `discoverCompatiblePlayers` rows on the client (rejected, and this is the load-bearing reason for the RPC — that function is paginated by `p_limit`, default 20 and max 50, so any block with more free players than one page holds would be silently undercounted, and a demand signal reading "20" when the truth is 34 is worse than none); using the `near_term_overlap_slots` the client already receives (rejected — `040` caps it at today plus two days, so a week does not fit); requiring the count to overlap the viewer's _own_ availability (rejected — it could then only describe slots they had already claimed, which is useless for deciding when to be free, and it makes the empty state a trap where no availability means no signal means no reason to add availability); pulling player cards to reduce them to an integer (rejected — that ships names, avatars, ratings and favourite clubs for a feature that displays none of it); applying `enforce_discovery_rate_limit` (rejected — that budget is 30 calls a minute shared across every surface and is spent by user-initiated searches, so charging a passive Home read to it would let opening Home make Discover raise `discovery_rate_limited`).
- Consequences: eligibility mirrors `discover_compatible_players` exactly on the rules a player cannot change — active, onboarded, adult, not blocked, in zone — and deliberately does **not** apply the level, format or intent filters, because those are the viewer's own adjustable preferences and Discover's default view does not restrict on them either; the count has to be a promise the Discover screen can keep. Verified by driving each rule and watching the count fall 5 → 4 → 3 → 2 → 1. The copy claims no proximity ("5 free", not "5 near you"), because when a player has set no zones the result is unrestricted, which is also what Discover shows them. A block in progress is trimmed to the time still remaining, so at 21:30 the evening no longer counts against the one-hour floor rather than advertising a match that cannot happen — verified with a 75-minute window of which only 26 minutes remained. The floor is one _contiguous_ hour, matching what `040` already requires of a shared slot. Counting is `distinct` on the player, because one person can hold both a recurring and a one-off window over the same block. The day part is derived from a block's **start**, never from its range: `availabilityDayPartsFromOverlap` reads both ends and a block's end is exclusive, so 07:00–12:00 would come back as `["morning", "afternoon"]` and the busiest morning of the week would be advertised as an afternoon. Chip and row counts match on the parsed instant rather than the string, since the RPC and `beirutLocalToUtcIso` can render the same moment as `+00:00` and `000Z`. Pinging does not invalidate the liquidity query: the function excludes the caller, so a player's own ping never moves their own numbers. `liquidity_signal_viewed` fires once per mount **including when empty**, because a tap rate is meaningless without knowing how often a player was shown any demand at all; `availability_ping_sent` gained `surface` (`chip` | `liquidity`) and `player_count`, so the pilot can tell which half converts and whether a bigger number converts better. Still to come: nothing reaches a player who is not in the app — a notification when real inventory appears is the remaining half, and it is the one proposal that has the app nudging on its own behalf, so it wants a deliberate decision rather than an assumption.
- Owner: Founder

## 2026-08-17 — "I'm free" is a one-off availability window, not a new concept

- Status: accepted
- Context: the smallest unit of intent the product accepted was a fully specified match — format, level, zone, clubs, time. Someone with a free Thursday evening and mild interest had nowhere to put it, so the evening was lost. In B=MAP terms the core action sat far to the left of the Action Line and needed a motivated host to cross it; this is the Starter Step that does not.
- Decision: one tap writes a **one-off `availability_windows` row** (`is_recurring = false` with `starts_at`/`ends_at`). No new table and no new read path: discovery already computes availability overlap against that shape (039/040/055), so a ping immediately makes the player findable by everyone whose availability overlaps, and they can see and remove it on the availability screen like any other window. Slots are offered as the next four blocks from now, using the same `TIME_BLOCKS` boundaries the profile grid and `availabilityDayPartFromLocalTime` already use (07:00/12:00/17:00/22:00 Beirut). Writes go through `record_availability_ping` (`073`) rather than the existing direct insert, because two rules cannot live in a client.
- Alternatives considered: a dedicated `availability_pings` table (rejected — it would need its own overlap query duplicating what discovery already does, and the player could not see or remove a ping alongside their other availability); reusing the existing `createAvailabilityWindow` direct insert (rejected — no dedupe, and nothing stopping a window in 2030); a free date/time picker (rejected — that is the create wizard again, and the entire point is one tap); showing a count of overlapping players as feedback (deferred — the honest statement "players free then can now find you" needs no query, and a number invites the question of who).
- Consequences: `record_availability_ping` dedupes by **range overlap**, not exact match — two taps on adjacent blocks are one continuous availability, and a duplicate row would make one player look like two openings in discovery. It bounds the window to at most twelve hours and to `[now - 2h, now + 14d]`, the two-hour grace so the current block can still be pinged after it has started. Before this, the one-off shape had 36 recurring rows and zero one-off ones, so the ping is its first real user. All Beirut arithmetic goes through `beirutLocalToUtcIso`, which resolves the offset for the specific date; tests pin both DST directions, because the same wall clock stores as 14:00Z in August and 15:00Z in January. A block is judged on its **end**, so at 18:00 the evening is still offered. `beirutDateKeyWithOffset` duplicates the private `addBeirutDays` in `near-term-availability.ts`; both belong in `beirut-time.ts`, which has unrelated changes in flight. Chip state is announced through the accessibility **label** rather than only `accessibilityState`, because react-native-web does not emit `aria-selected` for `role="button"` and a screen reader would otherwise report the chip as merely dimmed. `availability_ping_sent` required extending the `record_client_event` allowlist in SQL, which is the friction that design intends; the mirrored TypeScript union caught the drift when only the SQL side had been updated. Still to come: the weekly liquidity trigger that reads these pings back out ("4 players free Thursday"), which is what turns a written intent into a match.
- Owner: Founder

## 2026-08-17 — The completed match gets a celebration, and rematch gets two more surfaces

- Status: accepted
- Context: a completed match is the north-star event and it resolved into a silent status change plus a score form. In Tiny Habits terms repetition without celebration does not wire a habit, so the product's most important moment was doing no emotional work. Separately, the rematch card shipped on the hub only — it fired once, at the bottom of a screen the player has to scroll past the paperwork to reach. Cursor's parallel audit caught that gap and it was a fair hit.
- Decision: `get_rematch_context` (`072`) returns matches played together, who is ahead, and the caller's overall total, and the rematch card states it plainly: "That is match number 7 for you, and number 7 with Player B. You lead 2–1." Rematch also appears as a Home next-action and on each Completed list row. **Rematch deliberately stays below the score form on the hub** — both audits recommended inverting it, but a confirmed score is the only thing that moves a rating, and demoting the score form would suppress exactly the data hypothesis H5 depends on; the real complaint was that rematch was buried, which Home and the Completed row fix instead. Played-vs-rated is explained on Home, with a count of matches still waiting on a confirmed score.
- Alternatives considered: extending `list_my_completed_matches` with opponent ids so Home could build a draft directly (rejected — that row also lacks play intent, skill range and zones, so it still could not build one, and four screens depend on that RPC; fetching the hub on tap reuses `beginRematch` unchanged for the cost of one round trip); counting `resolved` results in the head-to-head (rejected — an operator void writes `resolved` per `026`, so those are precisely the results that did not stand); guessing an opponent for doubles (rejected — with several opponents there is no single "play them again", so the caller is sent to the hub where one button per opponent already exists); locale-aware ordinals for "your 3rd with…" (rejected — English, Arabic and French all differ; the copy is phrased with "number N" so it is grammatical at every value without plural machinery); a private rating-history screen (rejected — nobody has an earned rating yet, so it would ship empty for every pilot user).
- Consequences: win counts use `status = 'confirmed'` only, verified against `026`, so a pair can show "7 played together" with no head-to-head line — which the seed data does, and which is the honest reading rather than a hollow 0–0. `HomeNextAction.bodyParams` was renamed `params` and is now interpolated into the title as well: the title carried the opponent's name and rendered a raw `{{name}}` on screen, a defect no unit test on `deriveHomeNextActions` could have caught. `HomeNextActionKind` is exported and shared by `homeNextActionTone`, `homeNextActionLabelKey` and `homeNextActionRoute`, which each re-declared the union inline — the way a new kind gets handled in one place and silently defaulted in the others. `MatchCard`'s previously unused `footer` slot now renders **outside** the card's Pressable, because a button nested inside the card's button breaks keyboard navigation and screen readers; that was a real defect introduced and then found in the browser. The Home rematch offer is limited to matches completed within 14 days, matching H1 so the surface and the metric measure the same window. All three surfaces emit distinct `rematch_started` values (`hub`, `home`, `completed_list`), which was the point of the granularity adopted from Cursor's audit. Leading the result panel with "we played, no score" ahead of the score editor is deliberately deferred: it belongs in `MatchResultPanel.tsx`, which has the no-show reason work in flight.
- Owner: Founder

## 2026-08-17 — Product analytics live in Postgres, with the privacy rule enforced in SQL

- Status: accepted
- Context: the mobile app had no product analytics at all — Sentry only — so no retention claim in the audit was falsifiable. Nearly every question is answerable from the lifecycle tables, and those queries now live in `docs/PILOT_OPERATIONS.md`. Three are not: where onboarding loses people, how often Discover returns an empty room, and where the create flow is abandoned. Those are screen-level facts the database never witnesses, and they are exactly where the audit predicts the losses are.
- Decision: a `client_events` table plus a `record_client_event` RPC (`071`), no vendor SDK — which means no consent surface, no third-party processor and no new privacy review. Both the event name **and every prop key** are allowlisted inside the function, and string values must match `^[a-z][a-z0-9_]{0,31}$`, so an email, display name or phone number cannot be smuggled into a prop that was meant to hold `hub` or `players`. Adding an event therefore requires a migration; that is the point, because it forces the privacy question each time. Deliberately **not** `audit_events`: that is the operational and moderation trail, is read by operators, and carries its own retention policy. The push permission ask gained a second, contextual prompt on the match hub for users at `undetermined`, shown once per account per device — the onboarding primer is left alone.
- Alternatives considered: a vendor SDK such as PostHog (costs a consent surface and a processor agreement for data Postgres already holds); reusing `audit_events` (no migration, but mixes analytics into a moderation trail with different retention); client-side validation of props (a later edit can widen it silently — the database cannot be talked round); moving the notification ask out of onboarding, which the audit originally recommended and which was **wrong**: the primer already uses benefit cards and its "Not now" never fires the OS prompt, so nothing was being burned.
- Consequences: `record_client_event` deliberately does not call `assert_marketplace_caller()`. That delegates to `assert_discovery_caller_eligible()`, which rejects anyone with `onboarding_completed_at is null` — so the standard auth helper would have blocked precisely the onboarding drop-off events the table exists to record. It gates on `auth.uid()` instead. Events are fire-and-forget on the client and never surface an error to a player, and failures are not reported to Sentry because they fire on ordinary navigation, so a network blip would produce noise proportional to usage; a missing event shows up as a hole in the funnel instead. A 300-per-hour-per-user cap drops silently so a render loop cannot fill the table, and `on delete cascade` from `profiles` means a deletion request removes a player's events with them. `create_abandoned` is emitted on the create stack unmounting, so an app killed mid-flow records nothing — treat the abandon count as a floor. Pure decision logic is kept in files free of react-native imports (`push-nudge.ts`, `create-flow-analytics.ts` via mocked leaves), because importing the real `./supabase` pulls in react-native, which is Flow-typed and cannot be parsed by the test transformer.
- Owner: Founder

## 2026-08-16 — Match chat opens when the roster fills, not when the time is agreed

- Status: accepted
- Context: `isMatchHubChatAvailable` locked chat at both `open` and `full`, so chat actually opened at `ready_to_book`. Per `docs/LIFECYCLE.md`, `full → ready_to_book` requires every participant to vote yes on one time option — which put the lock on precisely the state that needs a conversation to escape it. A flexible-timing match sat at `full` where voting is allowed (`canVoteOnTimes` accepts `open`/`full`/`ready_to_book`) with no way for anyone to say "Thursday at 8, not 7", and the group's only recourse was WhatsApp, where somebody just declares a time. Two further consequences: withdrawing an agreed time takes `ready_to_book → full` and re-locked a live thread mid-conversation, and `matches.chat.lockedRecruiting` ("Chat opens when the roster is full") described a rule the code did not implement — a joiner could fill the roster, be told that was the unlock condition, and watch nothing happen. Established while auditing whether match chat could carry court-handoff coordination: it cannot on court-first matches, which sit at `open` for the whole club conversation.
- Decision: Chat opens at `full` and stays open for the rest of the lifecycle. `open` stays locked. Verified first that this was never a security boundary — `send_match_message` and `list_match_messages` gate on `is_match_chat_participant` (019), which checks accepted participation and never match status, and `match/[id]/chat.tsx` guards on `viewer_status === 'accepted'` alone. The server and the chat screen already permitted `full`; the hub entry was the only surface disagreeing, so this is a two-line presentation change with no migration and no RLS work.
- Alternatives considered: unlock at `open` as well (that is where the participant set is genuinely fluid on a public listing, so join-read-leave is a real privacy problem, and a half-filled match usually has nobody to message — court-first is the one case that wants it, and the structured court state from `070` serves those information needs better than free text); unlock at `full` only for fixed-timing matches (risks nothing, because there is no vote to bypass, but solves nothing either — the voting deadlock was the whole problem); make chat sticky so it never re-locks (a participant leaving still takes `full → open`; rarer and lower harm, and it needs new state to express "was ever full"); rewrite the locked copy to match the old behaviour (papers over the defect instead of fixing it, and leaves the deadlock in place).
- Consequences: the existing `matches.chat.lockedRecruiting` string becomes literally true, so no copy change was needed — the behaviour fix retired the copy bug. Accepted risk: on a flexible match the group can now agree a time in chat and never resolve the vote, leaving the match stuck at `full` and never reaching a court. Judged better than the status quo, where they do the same thing in WhatsApp and the session is lost too; the mitigation already exists, since `showVoteUi` renders at `full` so the vote prompt sits beside the chat. Still open, deliberately: whether court-first matches at `open` should get chat at all, and whether chat should ever re-lock.
- Owner: Founder

## 2026-08-16 — The WhatsApp court handoff is recorded, so the pilot can be read

- Status: accepted
- Context: v1 secures courts over WhatsApp by design — in-app club booking waits until the player side is proven and clubs have agreed to take part, and no club survey has been run yet. But `openWhatsAppBooking` called `Linking.openURL` and recorded nothing, and `confirm_external_court` (034) creates a booking that is already accepted, so a match jumped `ready_to_book` → `confirmed` in a single step with the window between invisible. Three consequences, all verified in code: no reminder could fire (`booking_stale_participant` in 022 requires a `bookings` row at status `requested`, which never exists on this path, so the one nudge built for a waiting court never runs for the only booking path v1 uses); no fallback to the next club could be offered; and the lifecycle jobs could not distinguish an abandoned match from one being actively arranged. The measurement consequence is the serious one: completed matches is the north-star, completed matches need a court, and courts ran through an unmeasured handoff — so the metric being used to prove the player side was partly measuring club-coordination friction, and a blended result could not tell the two apart.
- Decision: Record each reach-out in a new `match_court_requests` table (`070`). The host tapping through to a club writes an `opened` row before the app backgrounds; on return an inline hub prompt asks "did you send it?", moving the row to `sent` or `not_sent`. Every accepted participant can see that a club was asked and when, which closes the joiner blind spot. The funnel is then readable in two halves — `discover → agreed time` (the player side, the thing the pilot is testing) and `agreed time → played` (the court side, gated on clubs not yet signed) — with the operator queries recorded in `docs/PILOT_OPERATIONS.md`. Match chat remains the channel for the actual conversation; this only makes the state machine-readable.
- Alternatives considered: build in-app club booking now (contradicts the sequencing decision and depends on clubs that have not been asked yet); reuse the `bookings` table with an extra status (bookings carry club-staff visibility, court overlap constraints and the dashboard queue — a reach-out is an attempt, not a booking, and several attempts per match is precisely the number worth measuring); rely on the host relaying status in match chat, which was the original plan (chat is correctly timed — `isMatchHubChatAvailable` unlocks at `ready_to_book` — but free text informs humans and not the product, and relaying is an unprompted extra job asked of the host at their motivation trough; hypothesis H2b in the audit tests whether hosts relay reliably enough that this table is unnecessary); a modal triggered on app-lifecycle resume (needs AppState plumbing and dies with the process, whereas a server-side `opened` row means the prompt is still there tomorrow); a vendor analytics SDK (costs a consent surface and privacy review for data Postgres already holds).
- Consequences: `070_court_request_tracking.sql` adds `court_request_status`, `match_court_requests`, and `record_court_request_opened` / `answer_court_request` / `list_match_court_requests`. Writes are RPC-only and host-only, matching `confirm_external_court` (058) — contacting a club commits the group to a venue. A partial unique index on `(match_id, club_id) where status = 'opened'` makes a double tap a retry rather than a second attempt, and the `on conflict do update` is a deliberate no-op that forces `RETURNING` while preserving the original `opened_at`. Default privileges hand `anon` and `authenticated` TRUNCATE/TRIGGER/REFERENCES on any new public table; those are revoked and only `select` granted back to `authenticated`, because without a table grant the RLS policy would be unreachable and read as protection it was not providing. Recording is best-effort in the client: a failure is swallowed rather than blocking a host from reaching a club. Deliberately **not** included, each a separate decision: posting the state into match chat, expiry protection while a request is open, reminder notifications, and the one-tap next-club fallback.
- Owner: Founder

## 2026-08-16 — Three retention hooks that do not need a feed, a streak, or new data

- Status: accepted
- Context: The app has a structural frequency ceiling. Its loop is `want to play → play`, which fires once or twice a week for a recreational player, and between matches it has nothing to say. The competitor is not another app, it is the WhatsApp group already open on the player's phone. Most of the churn sits at one point: played once, nothing pulled them back. Three cheap levers were available without adding a surface the PRD excludes.
- Decision: (1) **Rematch at the result.** A completed hub offers "Play {{name}} again", which seeds the existing invite-a-player draft from the finished match and drops the host on the schedule step. The moment a match closes out is the only one where both players have just agreed it was worth playing; asking them to rebuild it from the Create tab a week later is where the second match dies. (2) **Notification copy names the job waiting on the reader,** not the event that occurred — "Your match is waiting on you / Say whether you played so the result can count" over "Did you play? / Confirm attendance after your match". No new kinds, no new params, no schema change; the pull comes from another human waiting, which is the strongest one there is. (3) **The provisional window gets a progress bar.** Home shows rated matches against the five-match threshold and the distance left, so the honesty constraint from M7.4 reads as a quest instead of an absence during exactly the stretch where a new player decides whether to return.
- Alternatives considered: streaks and daily check-ins (tennis is weekly at best, so a daily streak punishes normal behaviour and cheapens the product); login badges and a points game (the rating rules already forbid a day-one visible number, for good reason); a social feed and recurring standing groups (both excluded or post-pilot per `ROADMAP.md` — the rematch prefill is deliberately the cheap half of recurring groups, and does not create a recurrence model); adding a `playerName` param to `match_invitation` so push could say who invited you (needs a migration at the enqueue site; deferred rather than dropped); driving the progress copy through i18next plurals (Arabic has six plural forms and the locale key-parity test compares leaf keys exactly, so the copy is phrased to be grammatical at every value instead).
- Consequences: no migration and no new notification kind. `apps/mobile/src/lib/rematch-draft.ts` holds the rules; the CTA reuses `create-match-draft` and the `inviteForPlayer` branch in `match/create/index`, so the one-active-hosted-match rule and publish validation still apply unchanged. The rematch deliberately does not carry the old hour forward — `createMatchInputSchema` rejects past times, and picking the new time is the one decision a rematch actually has to make. It is offered only on `completed` matches where the viewer did not record `no_show`/`late_cancel`, and `unknown` counts as played because a match can complete on the 72-hour grace window without that viewer ever answering. Progress uses `rated_match_count`, never the completed-match count, so an unverified or disputed result does not promise a number that is not coming. Notification copy is duplicated in `packages/i18n` and `supabase/functions/_shared/notification-copy.ts`; the existing parity test enforces byte-identity across both and all three locales. Retention should be read as time-to-second-match and matches per active player per month — not DAU, which for a tennis app is the metric that would justify building the feed the PRD excludes.
- Owner: Founder

## 2026-08-15 — Attendance completes a match; the score is optional

- Status: accepted
- Context: Only `confirm_match_result` and `dispute_match_result` ever wrote `completed` (023:290, 023:342), so the north-star metric counted a match only if two people agreed a set-by-set scoreline. The pilot is launching as casual play with no referee, no leagues and no observer, where the ordinary match is two people who hit for an hour and never wrote the games down. Those matches sat at `in_progress` forever and counted nowhere, and nothing ever timed out. Competitor precedent points the same way: Playtomic auto-validates a submitted result after 24 hours and explicitly declines to adjudicate disputes, and UTR keeps self-reported results while labelling them rather than excluding them.
- Decision: A match completes when its participants confirm they played — all of them, or one plus a 72-hour grace window with nobody saying otherwise. Everyone answering "we did not play" expires it instead. A score becomes optional, can be entered by one participant before or after completion, and only a _confirmed_ score moves a rating. A submitted score auto-confirms after 72 hours **only** if the confirmation request actually reached the other side (`notifications.sent_at`); otherwise it lands on the new terminal `unverified` status, visible and attributed but unrated. Disagreeing reopens the result once to whoever objected; a second disagreement goes to the operator queue, where `void` remains the only honest resolution because with no referee there is nothing to weigh.
- Alternatives considered: keep a confirmed score as the completion bar (measures score-reporting diligence rather than matches played, and suppresses the one metric the pilot is judged on); permanent `unverified` with no timeout at all (punishes the player who did the right thing by submitting, and leaves matches hanging forever); plain auto-confirm on silence (lets one player farm a result against a dormant or unreachable opponent — the `sent_at` check exists to close exactly that); a separate `correction_proposed` state pair (doubles the state machine for something one reopen already expresses).
- Consequences: `063_result_unverified_enum.sql` and `064_attendance_completion_and_scoring.sql`. This amends the 2026-07-25 "Completed match definition"; that entry also required an accepted booking, a clause `048_match_played_prompt.sql` had already superseded. `docs/PRD.md` north-star wording updated to match. Confirming and disputing still complete the match, so nothing regresses for players who skip the attendance prompt. Rating is untouched: Elo, K=32, singles only, flat 1200 start. Reliability counters and counterparty no-show reporting are deliberately deferred — the input data is self-reported only, and `PRD:80` keeps reliability private to the player and operations until a later policy decision.
- Owner: Founder

## 2026-08-15 — Unconfirmed scores are shown and attributed, not hidden

- Status: accepted
- Context: With the score optional and one-sided, a submitted-but-unanswered score had to either appear in both players' history or in neither. `list_my_completed_matches` is viewer-scoped, so hiding it from the non-submitter would have left the same match telling two different stories depending on who looked, and left a wrong score unchallenged because the only person who could correct it never saw it.
- Decision: Show unconfirmed scores in shared match history, always labelled with who entered them ("Reported by Rami — not confirmed"), with a one-tap way for the other side to disagree. Precedent is UTR, which keeps self-reported results and labels them rather than excluding them. The public player profile is narrowed the other way: `list_public_player_recent_matches` now shows confirmed results only, because one player's unanswered claim does not belong on a stranger's screen as record.
- Alternatives considered: hide until confirmed (creates two versions of one match and removes the only prompt that ever gets a wrong score fixed); show unconfirmed scores publicly too (broadcasts an unanswered claim about someone to people who cannot correct it).
- Consequences: scores stay participants-only either way — the public player card carries the completed-match count, never the scores. `match_results` gains `side_a_user_ids`, `winning_side`, `revision` and `disputed_by`; `list_my_completed_matches` returns `viewer_side` and the submitter's name, and every result-derived field on it is now nullable because a completed match with no score is the ordinary case.
- Owner: Founder

## 2026-08-15 — Scores are stored side-relative, and the server derives the winner

- Status: accepted
- Context: Sets were stored from the winner's perspective and `isValidTennisSet` rejected any set the declared winner had lost (`packages/domain/src/results.ts:51`), so 6-4, 4-6, 6-3 — an ordinary three-setter — could not be recorded at all. Separately, `submit_match_result` took the winner as a parameter and never checked it against the score, and validated the score only as "`sets` is a non-empty array" (023:123). A caller reaching past the app could name themselves the winner of a match they lost.
- Decision: Sets become `[sideAGames, sideBGames]` against a `side_a_user_ids` stored on the result. The winner parameter is removed; the server validates every set and derives the winning side by counting. Level sets raise `score_has_no_winner` — retirements and walkovers stay an operations rule, per `docs/DATABASE.md`. Doubles confirmation gains the rule that the confirmer must be on the side opposite the submitter, which stops a partner rubber-stamping their own team's claim without needing a team model on `match_participants`.
- Alternatives considered: keep winner-perspective and only add validation (leaves the three-setter defect and cannot derive the winner); add a `side` column to `match_participants` (threads a team model through every join, invite and leave path to express something the result alone can say).
- Consequences: `is_valid_tennis_set` is now symmetric on both sides of the wire, and `packages/domain/src/results.ts` mirrors the SQL rather than owning the rule. Existing rows back-fill cleanly: side A is the winner's side, and stored sets already read in that orientation. `list_public_player_recent_matches` and `list_my_completed_matches` both stopped comparing against `winner_user_id`, which had made a doubles winner's partner a loser in their own history.
- Owner: Founder/technical reviewer

## 2026-08-14 — Drop singles/doubles preference from Discover and profile filters

- Status: accepted
- Context: Discover could filter players by profile singles/doubles preference, and onboarding / Match defaults required that preference. At pilot scale every hard filter hurts liquidity, and format is usually a per-match choice (capacity 2 vs 4), not a stable identity like level or area.
- Decision: Remove Discover format matching chip and all preference-driven format filtering. Stop collecting singles/doubles preference in onboarding and Match defaults. Keep match format on create and a single create-default format on Match defaults. Persist `prefers_singles` / `prefers_doubles` as both true when saving defaults; columns remain for legacy rows.
- Alternatives considered: keep soft ranking by format preference (still biases the feed); keep preference UI without filtering (noise without benefit).
- Consequences: Discover chips are level / intent / area / availability only. Profile cards no longer show a format preference tag. Create match and host default format stay.
- Owner: Founder

## 2026-08-14 — Hub confirm picks a club; no court picker on the card

- Status: accepted
- Context: Preferred-club confirm asked the host to pick a club and then a court. v1 WhatsApp clubs rarely need a named court in-app before players turn up, and the second picker added copy and height without changing the booking path.
- Decision: Confirm stage selects a preferred club only. The first court on that club is used for `confirm_external_court`. Escape links still cover another club or a different time via the external booking screen. Club detail (match-scoped) follows the same rule: no court radios; Message / Request / Confirm use the first court.
- Alternatives considered: keep the court radio list (more accurate, more friction); delay confirm until club detail (extra navigation for the primary action).
- Consequences: Hub preferred-club cards stay image + name/location + Message / View; primary CTA is Confirm once a club is selected. Club detail drops the courts list and long confirm help copy.
- Owner: Founder

## 2026-08-13 — Hub booking CTA is Contact + Booked off-app, not Request court

- Status: accepted
- Context: v1 clubs are WhatsApp (`external_link`); the in-app Request court queue still has no staff delivery channel. Preferred-club Contact already opens the real booking path, so a second Request court button duplicated a dead end.
- Decision: Hide Request court on the match hub. Host flow is Contact on a preferred club (or open club details from the card), then Booked off-app to record the court. Preferred club cards navigate to club detail for everyone; Contact stays host-only.
- Alternatives considered: keep Request court as a browse-clubs entry (overlaps Contact and the off-app confirm screen); route Request court straight to WhatsApp (two labels for one action).
- Consequences: Hub primary for ready-to-book hosts is Booked off-app when applicable. `match/[id]/book` remains for deep links / later in-app clubs.
- Owner: Founder

## 2026-08-12 — Court Contact and Booked off-app are host-only

- Status: accepted
- Context: Migration 041 let any accepted participant record an off-app court (and match-scoped WhatsApp followed the same roster gate) so whoever held the club membership could book. In the ready-to-book hub that meant joiners saw Contact and Booked off-app beside the host, which split who commits the group to a venue.
- Decision: Host-only for both. `canConfirmExternalCourt` requires `viewerIsCreator` in every status; preferred-club Contact on the hub is creator-gated; `confirm_external_court` and `get_club_whatsapp_booking_link` (when `p_match_id` is set) refuse non-creators. Club-directory WhatsApp without a match stays open to eligible players.
- Alternatives considered: keep joiner off-app confirm while hiding Contact only (still two bookers); leave enforcement client-side only (API bypass).
- Consequences: `058_host_only_court_booking.sql`. Supersedes the participant-wide off-app confirm rule from 041 for product UX; court-first early secure remains host-only as in 046.
- Owner: Founder

## 2026-08-08 — Hosting defaults come from the profile; no first-create sheet

- Status: accepted
- Context: The 2026-08-06 decision below put a first-create sheet in front of hosting. As built it collected nothing — read-only chips plus a device-local acknowledgement — while the Discover and approval toggles it was meant to own stayed on the schedule screen for every create. It cost a tap and saved none. Separately, preferred clubs never pre-filled for anyone: `seedFavoriteClubIds` reads only favourite clubs, and nothing in onboarding ever set a favourite, so with Discover on (the default) the club picker stayed open on every create.
- Decision: Remove the first-create sheet and its local flag. Hosting defaults are edited in Profile → Match defaults; anything can be overridden per match from the schedule summary bar. Favourite clubs are collected once on a first-run pass through Profile → Where I play, reached from the onboarding completion screen; hosts who skip it have the clubs from their first published match saved as favourites, so the second create pre-fills.
- Alternatives considered: restore the toggles to the first-create sheet and persist them (keeps an extra screen for no gain now that Match defaults exists); collect favourite clubs as a real onboarding step (`list_clubs_directory` and `set_club_favorite` both go through `assert_discovery_caller_eligible`, which rejects callers whose `onboarding_completed_at` is null, and the onboarding layout redirects anyone already complete — so no step inside onboarding can list or save clubs); auto-select nearby clubs when favourites are empty (migration 045 makes the host's club list authoritative and visible to joiners before they commit, so filling it with clubs the host never chose misrepresents them).
- Consequences: `match_defaults_set_at` is no longer a gate. The column and its write in `updateMatchHostDefaults` stay as a record of whether a host has ever customised defaults; `ownPlayerProfileHasMatchDefaults` is removed. `apps/mobile/app/match/create/first-defaults.tsx` and `apps/mobile/src/lib/match-defaults-local.ts` are deleted.
- Owner: Founder

## 2026-08-06 — Match-host defaults and simplified create flow

- Status: accepted
- Context: Repeat hosts re-entered format, intent, level, and Discover toggles on every create despite onboarding and profile already capturing most preferences.
- Decision: Store match-host defaults on `player_profiles` (visibility, approval, optional level range and default format). Onboarding keeps skill, intent, format, and zones. First create prompts only for Discover and join approval once (`match_defaults_set_at`). Later creates hydrate the draft from profile and open a single schedule screen (time, clubs, summary, publish). Profile → Match defaults edits all hosting defaults. Per-match overrides remain on a separate screen without updating saved defaults.
- Alternatives considered: collect Discover in onboarding (deferred liquidity choice away from first value moment); keep three-step create wizard (extra taps for repeat hosts).
- Consequences: `053_match_host_defaults.sql`. `CREATE_MATCH_ROUTE` is `/match/create` orchestrator. Invite-from-player flow skips first-defaults and keeps invite-only visibility.
- Owner: Founder

## 2026-08-06 — Mobile forest-green brand and semantic status tones

- Status: accepted
- Context: `packages/ui` keeps a blue brand ramp for the club dashboard while the mobile app reskinned to Figma forest green (`#0F5132` / `#C8E63B`). Status badges previously used a single amber slot, so opposite facts (court secured vs expiring) competed.
- Decision: Mobile uses scoped tokens in `apps/mobile/src/theme/tennis-tokens.ts` including `tennisSemantic` tones (neutral, info, positive, attention, critical, actionable) with mandatory glyphs. Dashboard tokens stay unchanged. Attendance/reliability tones must not appear on public player profiles.
- Alternatives considered: rebrand dashboard and shared `packages/ui` in the same pass (too wide for UI polish milestone); per-status hardcoded colours (does not scale when status axes disagree).
- Consequences: mobile and dashboard look related but not identical until a deliberate shared rebrand. Skill bands use a separate ordinal ramp from semantic tones.
- Owner: Founder

## 2026-08-06 — Arabic RTL enabled in pilot locales

- Status: accepted
- Context: Arabic translations were complete but withheld from `PILOT_LOCALES` because `I18nManager.forceRTL` was not wired (see 2026-08-03 entry below).
- Decision: Mobile calls `syncNativeLayoutDirection` on locale load/switch (`apps/mobile/src/lib/layout-rtl.ts`) and re-adds `ar` to `PILOT_LOCALES`. Secondary screens may still need a device pass; critical flows were the gate for re-enabling.
- Alternatives considered: keep Arabic hidden (blocks Lebanese pilot users); ship Arabic LTR (worse UX than English).
- Consequences: switching to Arabic triggers an app reload on native platforms when direction flips. Layout direction hook coverage on older screens should improve over time.
- Owner: Founder

## 2026-08-03 — v1 ships player-side only; every club is a WhatsApp club

- Status: accepted
- Context: `CLAUDE.md` lists "club dashboard" and "booking request and manual club approval" in the MVP, but the in-app queue cannot work yet: there is no delivery channel to club staff, so a request lands in a dashboard nobody is told about (see the 2026-07-28 entry and the gate in `docs/STAGING_CHECKLIST.md`). Meanwhile the off-app path has become the most developed one in the codebase — the host records a court, before or after the roster fills, at whatever hour the club actually gave (host-only since 2026-08-12). Lebanese clubs book over WhatsApp regardless.
- Decision: v1 is the player side alone. Every pilot club is `booking_mode = 'external_link'`, surfaced as a WhatsApp link on the club card, and the host records the booking afterwards with `confirm_external_court`. Recruiting clubs onto a dashboard is deferred until the player side is proven. This defers two items `CLAUDE.md` lists under MVP; that document has not been amended, so it and this entry currently disagree.
- Alternatives considered: ship the club dashboard alongside (blocked on a staff notification channel that does not exist, and asks a pilot club to watch a queue before the app has any players in it); keep both modes live and let clubs choose (the in-app mode looks functional to a player while silently going nowhere, which is worse than not offering it).
- Consequences: no club-side verification — a court record is one player's word, which is acceptable while `payment_method` is always `pay_at_club` and a result still needs mutual confirmation. The app cannot see a walk-in the club booked by phone, so the overlap constraint only protects against two app matches claiming one court. Clubs get no demand visibility, which is a sales problem rather than a technical one. `request_match_booking`, `accept_booking` and the alternative-proposal flow stay in place as dead-for-now code rather than being deleted. **"No club-side app" means no club-staff role, not no dashboard**: result disputes, safety reports and club approvals remain platform-ops surfaces and stay in scope.
- Owner: Founder

## 2026-08-02 — Court-first booking: `confirmed` means roster and court, not court alone

- Status: accepted
- Context: Every booking path required a full roster first — `request_match_booking` (030:281) and `confirm_external_court` (045:856) both called `assert_match_roster_full`, and the latter only ran from `ready_to_book` or `booking_pending`. That is backwards for a Lebanese player holding a club membership: getting a court takes two minutes, finding a fourth is the hard part. The stranded match this whole area keeps working around is a symptom of the ordering.
- Decision: `confirmed` now means **full roster and accepted court**, rather than "an accepted booking exists". A match holding a court while still recruiting keeps its ordinary roster-driven status (`open`/`full`), so discovery, joining, leaving and the host's active-match slot are untouched. `refresh_match_open_state` — already the sole owner of the roster-to-status mapping and already called from every join, leave and invite path — became booking-aware and is now the only thing that writes `confirmed` for the external path. Booking early is creator-only and fixed-timing-only with an agreed time. The court shows in Discover, the matches list and home.
- Alternatives considered: a new `court_secured` status (would have to be threaded through every status list, the discovery filter, joinability, the cancellation policy and three locale files, to express something the pair (roster, booking) already says); extending court-first to the in-app club queue as well (`request_match_booking` moves the match to `booking_pending`, which would make it undiscoverable and unjoinable — decoupling booking status from match status throughout the hub, `next_action` and the awaiting-club banner is a separate, larger change); letting an unfilled court-first match sit indefinitely (`match_should_expire` refused to expire anything holding a booking, so these would accumulate forever and never release the host's slot).
- Consequences: `046_court_first_booking.sql`. `match_should_expire` now distinguishes a pending request (club still deliberating, no expiry) from an accepted court (the court's own hour becomes the deadline). `reschedule_match_time` checks the booking directly, because status alone no longer proves the hour is free. New `court_first_roster_reminders` job warns the host 24 hours out; `list_my_matches` and `discover_open_match_card` carry the court. Court-first is unavailable to flexible-timing matches by design. A court-first match that reaches `confirmed` then loses a player follows the ordinary confirmed rules — `withdraw_from_booked_match`, not `leave_match`.
- Owner: Founder

## 2026-08-02 — Hosts name preferred clubs; off-list courts are announced, not blocked

- Status: accepted
- Context: A player joined knowing only a zone, which in Beirut holds several clubs a half-hour apart at different prices. The venue first became visible after somebody booked it: `get_match_hub` exposes a club name only through the `booking` payload, which does not exist until a court is requested. `confirm_external_court` (041) then notified the group with "a court has been arranged directly with the club" — no club, no time. So the first thing a joiner learned about where they were playing was that the decision had already been made without them.
- Decision: Hosts pick 1–3 clubs at creation, stored in `match_preferred_clubs` and surfaced on the Discover card and the match hub before joining. Required for `public` matches, optional for `invite_only` and `private`. The host's list is authoritative — joining is consent to it. A court recorded at a club outside the list is still accepted, but the notification says so and the audit event carries `off_preferred_list`. The court-confirmed notice now names the club and the Beirut-local hour.
- Alternatives considered: per-joiner club approval with the usable shortlist as the intersection of everyone's picks (deadlocks — four players each accepting a subset of three clubs frequently share none, stalling the match before the roster is even full); blocking off-list courts outright (the agreed club being full at the agreed hour is the ordinary reason somebody rings a second club, so this rebuilds the stranded match that 034 and 041 exist to prevent); leaving the rule client-side only (the parallel `zone_ids` check already lives in `create_match_draft`, so the club check belongs beside it).
- Consequences: `045_match_preferred_clubs.sql`. `create_match_draft` and `create_and_publish_match` gained `p_preferred_club_ids`, so 19 pgTAP fixtures that publish public matches now pass a club. `match_hub_card` and `discover_open_match_card` gained a `preferred_clubs` attribute. A `confirmed` match still does not guarantee a court at a club anyone pre-approved — it guarantees the group is told when it is not. Matches created before this migration have an empty shortlist and are never treated as off-list. Editing the shortlist after creation is not yet possible; a wrong pick means cancelling and recreating.
- Owner: Founder

## 2026-07-28 — Ship the pilot in English and French only

- Status: accepted
- Context: Arabic translations are complete and guarded in CI for key parity, stale placeholders, and real Arabic script. But the app never calls `I18nManager.forceRTL`, so Arabic strings render inside a left-to-right layout: rows, alignment and directional affordances stay LTR on nearly every screen. Only two screens use the manual direction hook. Enabling native RTL is a few days of work plus a device pass, which does not fit before the pilot.
- Decision: Offer only English and French in the language picker (`PILOT_LOCALES`). Keep the Arabic locale files, the `SUPPORTED_LOCALES` list, and every CI guard intact so the translations stay honest and nothing rots.
- Alternatives considered: ship Arabic strings inside an LTR layout (worse than not offering it — it looks broken rather than absent); delete the Arabic locale (loses finished translation work and the CI guard); enable `forceRTL` and accept rough edges on secondary screens (still needs a device pass nobody has run).
- Consequences: Arabic-preferring pilot users get English or French. Founder priority "Arabic RTL must work on critical flows" is explicitly deferred, not silently missed. Re-enabling is a one-line change to `PILOT_LOCALES` once `forceRTL` lands and the critical flows have been walked on a device.
- Owner: Founder

## 2026-07-28 — Park notifications with no delivery channel instead of failing them

- Status: accepted
- Context: Push registration exists only in the mobile app, so club staff working in the web dashboard have no `device_push_tokens` rows. The 4-hour booking nudge is enqueued for them, the Edge Function finds no tokens, and it called `mark_notification_failed('no_active_token')` — burning three retries and then recording a delivery failure. Retrying a push to a device that does not exist can never succeed, and it made "no club has ever been notified" indistinguishable from ordinary transient failures.
- Decision: Add `mark_notification_unreachable`, which parks such rows immediately as `no_delivery_channel` with no retry, plus `unreachable_notification_summary` for operators. Choosing an actual out-of-band channel for club staff is a separate decision, recorded as a hard gate in `docs/STAGING_CHECKLIST.md`.
- Alternatives considered: build transactional email (needs a provider account and secret the project does not have); WhatsApp Business sender (needs Meta verification, but matches how Lebanese clubs actually work); suppress the enqueue entirely for tokenless users (loses the backlog and the evidence).
- Consequences: the message still does not reach club staff — this only stops the signal being lost and the metric being polluted. An ops-driven channel is viable at 5–8 clubs. The gate must be closed before real clubs depend on nudges.
- Owner: Founder

## 2026-07-22 — Matchmaking-first MVP

- Status: accepted
- Context: Lebanon already has broad sports booking products; the unserved core problem is coordinating a compatible opponent, time, and court reliably.
- Decision: Build the completed-match loop first, with lightweight manual club approval.
- Alternatives considered: booking-only marketplace; full club-management system; tennis social network.
- Consequences: payments, coaches, leagues, advanced tournaments, social feed, and other sports are excluded from MVP.
- Owner: Founder

## 2026-07-22 — Shared TypeScript product stack

- Status: proposed
- Context: A solo founder using Claude Code benefits from one language and one cross-platform mobile codebase.
- Decision: Expo/React Native mobile, Next.js dashboard, Supabase backend, TypeScript monorepo.
- Alternatives considered: Flutter; native iOS/Android; Firebase backend.
- Consequences: framework versions must be selected for current compatibility during bootstrap; PostgreSQL/RLS becomes the main authorization boundary.
- Owner: Founder/technical reviewer

## 2026-07-25 — Discovery via Postgres RPCs

- Status: accepted
- Context: Player and open-match discovery requires availability overlap, block exclusion, and privacy-safe projections; client-side filtering would leak calendar data and bypass authorization.
- Decision: Implement `discover_open_matches` and `discover_compatible_players` as validated `security definer` RPCs; list views return coarse compatibility hints only.
- Alternatives considered: PostgREST views with broad RLS; client-side filter after fetching profiles; materialized discovery index refreshed nightly.
- Consequences: M2 migration must include RPCs, rate-limit logging, skill-band rank helper, and SQL tests; mobile uses TanStack Query wrappers only.
- Owner: Founder/technical reviewer

## 2026-07-25 — Exclude gender filtering from v1

- Status: accepted
- Context: PRD mentions gender preference only if legally/product-approved; no safeguarding or legal review completed.
- Decision: No gender filter in MVP create-match or discovery flows.
- Alternatives considered: Optional match-level preference with enum; profile-level gender with strict visibility rules.
- Consequences: Remove gender from pilot UX until explicit legal/product approval; schema unchanged in v1.
- Owner: Founder

## 2026-07-25 — Exclude minors from v1 matchmaking

- Status: accepted
- Context: Junior accounts require guardian consent and communication restrictions not yet designed.
- Decision: Require `is_adult_confirmed = true` before public discovery, match create/join, and chat.
- Alternatives considered: Guardian-managed accounts in v1; age gate without verification.
- Consequences: Birth year collected but minors cannot enter marketplace flows until a later milestone.
- Owner: Founder

## 2026-07-25 — Email magic link authentication for v1

- Status: accepted
- Context: Needed before Milestone 1; SMS OTP has per-message cost and deliverability risk in Lebanon, native social sign-in adds app-store scoping work.
- Decision: Use Supabase Auth email magic link as the only sign-in method for the pilot.
- Alternatives considered: Phone/SMS OTP; Apple/Google social sign-in in addition; combination of all three.
- Consequences: Onboarding flow (E1) designs around email verification only; revisit social sign-in and SMS OTP post-pilot if drop-off data justifies it. Contact verification = verified email.
- Owner: Founder

## 2026-07-25 — Pilot zone geography deferred

- Status: proposed
- Context: Founder has not yet selected the specific dense corridor for the 5–8 partner club pilot.
- Decision: Use placeholder/configurable seed zones for Milestone 0–2 development; real zone names and boundaries to be supplied before pilot seed data is finalized (Milestone 8).
- Alternatives considered: Blocking development until geography is chosen.
- Consequences: `supabase/seed.sql` uses generic placeholder zone names until real geography is provided; must be revisited before pilot launch.
- Owner: Founder

## 2026-07-25 — Match expiry and in_progress via scheduled jobs

- Status: proposed
- Context: State machine included `expired` and `in_progress` without transition rules, affecting discovery and reminders.
- Decision: Hourly expiry for stale/open matches (7-day cap or all proposed times passed + 24h grace); `confirmed → in_progress` at booking start via 5-minute job. See `docs/LIFECYCLE.md`.
- Alternatives considered: Client-only status display without persistence; manual club-only transitions.
- Consequences: M6 adds Edge Function/cron jobs; expired matches drop out of discovery automatically.
- Owner: Founder/technical reviewer

## 2026-07-25 — Supabase hosting region for Lebanon pilot

- Status: proposed
- Context: PRD targets P95 reads under 2 seconds on normal Lebanese mobile connectivity; Supabase has no Middle East primary region.
- Decision: Default staging and production to Central EU (Frankfurt, `eu-central-1`); validate latency from Beirut on pilot devices before production lock.
- Alternatives considered: West EU (Paris/London); Mumbai (higher latency from Lebanon); deferring region choice until M8.
- Consequences: All hosted Supabase projects created at bootstrap should use the same region; revisit read replicas only if measured latency or read load justifies cost.
- Owner: Founder/technical reviewer

## 2026-07-25 — Atomic onboarding completion boundary

- Status: accepted
- Context: E1 writes identity, consent, tennis preferences, and zones across four tables. Partial client writes could incorrectly mark an incomplete or underage profile ready for matchmaking.
- Decision: Create the blank `profiles` row from an `auth.users` trigger, persist encrypted onboarding progress on-device, and finalize all required fields through one `complete_onboarding` database function. The function derives `auth.uid()`, validates adult status and current policy versions, and stamps completion only after every write succeeds.
- Alternatives considered: direct client inserts per screen; a partially complete server-side profile updated after every step; an Edge Function.
- Consequences: incomplete users can resume onboarding but cannot enter main product routes; policy versions and protected account/rating fields are not client-editable.
- Owner: Founder/technical reviewer

## 2026-07-25 — Provisional skill questionnaire v1

- Status: proposed
- Context: E1 requires a short questionnaire, while the exact pilot wording and calibration have not been validated with players.
- Decision: Ask four self-assessment questions (experience, play frequency, rally ability, match experience), score each from 0–4, and map totals to the existing five database bands. Show only the provisional band and never claim UTR/NTRP compatibility.
- Alternatives considered: direct band selection; coach assessment; numeric rating shown immediately.
- Consequences: the scoring stays in the shared domain package, is unit tested, and can be recalibrated before the pilot without changing stored enum values.
- Owner: Founder/product validation

## 2026-07-25 — Development policy and support placeholders

- Status: accepted for development only
- Context: M1 needs versioned consent and a deletion/support path, but approved legal copy and the final support address are not yet available.
- Decision: Use clearly marked `dev-2026-07-25` policy drafts and a `.invalid` local support address. Staging and production configuration reject the placeholder address.
- Alternatives considered: block M1 until legal review; omit policy content; hard-code a personal founder email.
- Consequences: no public pilot may use the development drafts; founder/legal review and a real support address remain release blockers.
- Owner: Founder/legal reviewer

## 2026-07-25 — Completed match definition

- Status: accepted
- Context: PRD north-star metric, LIFECYCLE completion rules, and rating rules used different completion criteria.
- Decision: A completed match requires an accepted booking, required participants, and a mutually confirmed result (or admin resolution). Attendance confirmation alone does not complete a match in v1.
- Alternatives considered: attendance-only completion; "confirmed venue" without a club booking row.
- Consequences: north-star metric, state machine, and rating all use the same bar; PRD and LIFECYCLE aligned.
- Owner: Founder

## 2026-07-25 — Result dispute does not flip match status

- Status: accepted
- Context: `match_status.disputed` and `result_status.disputed` overlapped without clear transition ownership.
- Decision: A disputed result sets `result_status = disputed` while the match remains `completed`. `match_status.disputed` is reserved for explicit platform-admin action on the match itself.
- Alternatives considered: flip match to `disputed` on any result dispute; remove `match_status.disputed`.
- Consequences: match hub can show completed state with a pending result dispute; ops queue uses result status.
- Owner: Founder/technical reviewer

## 2026-07-25 — Unanimous time agreement

- Status: accepted
- Context: PRD said "sufficient participant agreement" while E4/LIFECYCLE implied all required participants must approve one slot.
- Decision: A match becomes `ready_to_book` only when all required participants vote yes on the same time option.
- Alternatives considered: majority vote; creator-selected slot after partial votes.
- Consequences: vote RPC and UI copy use unanimous threshold; no ambiguity in M4 implementation.
- Owner: Founder

## 2026-07-25 — Milestone 3 match RPCs and Matches tab

- Status: accepted
- Context: Match creation, joins, invites, and hub reads must enforce capacity, blocks, and visibility without exposing privileged table writes to clients.
- Decision: Add `007_matches.sql` security-definer RPCs (`create_and_publish_match`, `join_match`, `respond_to_join_request`, `leave_match`, `cancel_match`, `create_match_invite`, `accept_match_invite`, `get_match_hub`, `list_my_matches`); hash invite tokens with `extensions.digest(..., 'sha256')` hex; add a fourth mobile tab **Matches**; all write RPCs are `VOLATILE`.
- Alternatives considered: direct client inserts on `matches` / `match_participants`; storing raw invite tokens in the database; keeping match management on Home only.
- Consequences: mobile uses API wrappers only; share-sheet deep links use `tennislebanon://invite/{token}`; leave/cancel copy uses placeholder policy keys until M8 numeric windows.
- Owner: Founder/technical reviewer

## 2026-07-26 — Leave match reopens discovery and rejoin

- Status: accepted
- Context: On web, `Alert.alert` with cancel/confirm buttons does not invoke destructive callbacks, so leave never ran. Even when leave succeeded, `discover_open_matches` excluded any prior participant row (including `left`), and `join_match` could not reinsert because of the `(match_id, user_id)` primary key.
- Decision: Use `window.confirm` on web for destructive confirmations; treat only active participant statuses (`accepted`, `requested`, `invited`) as discovery exclusions; reactivate `left`/`declined`/`removed` rows on rejoin instead of inserting duplicates.
- Alternatives considered: delete participant rows on leave; show full matches in discover.
- Consequences: departed players can find and rejoin open matches; `009_leave_and_rejoin.sql` updates RPCs accordingly.
- Owner: Founder/technical reviewer

## 2026-07-26 — Milestone 3.5 invites inbox and borrowed player UX

- Status: accepted
- Context: Pilot testing showed that creating a match from a player card does not notify the target player; share-link invites work but are easy to miss. Competitor apps (e.g. RacketPal) emphasize player outreach and in-app invite surfaces. Full chat, feed, leagues, multi-sport, and coach marketplace remain out of MVP scope per PRD.
- Decision: Add **Milestone 3.5** before M4: in-app **Invites** inbox (`list_my_match_invites`, accept/decline), **multi-invite** from player cards with singles first-accept-wins, and clearer **player card CTAs** (create match / invite to open match). Optional **last active** on discover cards. Defer push notifications to M6; defer favorite clubs and read-only coach lists to M5; defer Google/phone auth to M8 unless onboarding metrics require earlier; defer padel to post-pilot.
- Alternatives considered: chat-first coordination like RacketPal; notifications-only without inbox; blocking M4 until invites ship inside M3.
- Consequences: `docs/ROADMAP.md` includes M3.5 and a borrowed-UX table; M3 backend (`match_invitations`, `accept_match_invite`) is extended rather than replaced; match lifecycle (vote → book → play) unchanged.
- Owner: Founder/technical reviewer

## 2026-07-26 — Milestone 4 unanimous time voting

- Status: accepted
- Context: After a match is full, participants must agree on one proposed slot before court booking (M5). Majority vote is insufficient when any player cannot make a time.
- Decision: Add `cast_match_time_vote`, `withdraw_match_time_option`, `add_match_time_option`, and `refresh_match_time_agreement`; transition `full` → `ready_to_book` only when at capacity and every accepted participant has voted `yes` on the same active option; revert to `full` when agreement is lost; extend `get_match_hub` with vote counts and `time_agreed` next action.
- Alternatives considered: first-yes-wins; creator picks time unilaterally; majority vote.
- Consequences: `011_time_voting.sql`; hub shows yes/no per slot; creator can add (max 3 active) or withdraw options before booking; `refresh_match_open_state` clears `selected_time_option_id` when capacity drops.
- Owner: Founder/technical reviewer

## 2026-07-26 — Match-first invite UX (M3.5 refinement)

- Status: accepted
- Context: Pilot flow tied “invite player” to “create new match”, forcing duplicate matches per invite and a four-step create wizard.
- Decision: Single-page create → publish → **Invite players** screen with compatible player cards; player profiles use **Invite to match** when the viewer has an open match, otherwise **Create match**; hub exposes **Invite players** for creators with spare capacity.
- Alternatives considered: keep create-and-invite from player card; chat-first outreach; defer UX until post-pilot polish only.
- Consequences: removes `invitePlayerIds` draft auto-send; old create sub-routes redirect to `/match/create`; acceptance test #1 starts at create → invite screen.
- Owner: Founder/technical reviewer

## 2026-07-26 — One active hosted match per format (P0)

- Status: accepted
- Context: Acceptance testing produced many forgotten `open` 1/2 singles matches; invite and create flows became confusing.
- Decision: Enforce at most one creator-hosted match per `match_format` while `status in ('open', 'full', 'ready_to_book')`; block `create_and_publish_match` with `active_hosted_match_exists`; create UI shows continue-inviting redirect; creator may `cancel_match` through `ready_to_book`.
- Alternatives considered: unlimited matches with UI-only grouping; hard delete of stale rows; global cap across formats.
- Consequences: `012_active_hosted_match_limit.sql`; P1 stale badges + expiry job and P2 reminder notifications tracked in `docs/ROADMAP.md`.
- Owner: Founder/technical reviewer

## 2026-07-26 — M4.5 design foundation (sky blue, reference flow)

- Status: accepted
- Context: M4 acceptance passed; founder provided RacketPal-style references (pill tabs, bottom sheets, chip pickers, organise-game CTA, player cards with avatar/level/location).
- Decision: Add **Milestone 4.5** before M5: switch primary brand to sky blue (`#2ab1f5`), introduce shared mobile UI primitives, restore a **3-step create wizard**, and restyle Discover/Matches/hub/invite anchor screens. Full RTL/animation polish remains post-M5/M6.
- Alternatives considered: full polish only after M6; keep green brand; single-page create with styling only.
- Consequences: `packages/ui` tokens; `apps/mobile/src/components/AppUi.tsx`; create flow routes `details` → `schedule` → `review`; player cards show `avatar_path`, skill band, and zone labels.
- Owner: Founder/technical reviewer

## 2026-07-26 — Create flow visibility as discover toggle

- Status: accepted
- Context: The three-way visibility picker (`public` / `invite_only` / `private`) confused creators during M4.5 setup; most users only need “show on Discover” vs “invite people I choose.”
- Decision: Replace the visibility chip picker with **List on Discover** (maps to `public` when on, `invite_only` when off) plus **Approve join requests** (only when listed). Drop `private` from the create UI; keep the enum in the API/schema for future use.
- Alternatives considered: keep all three options with tooltips; default everything to invite-only; remove approval toggle entirely.
- Consequences: `visibilityFromListOnDiscover` / `listOnDiscoverFromVisibility` in `@tennis-lebanon/domain`; create step 1 grouped into Match type / Match level / Who can join; review summary shows join settings instead of raw visibility labels.
- Owner: Founder/technical reviewer

## 2026-07-26 — Draft-first match creation

- Status: accepted
- Context: Creators reaching the invite screen had matches already live; finishing the flow felt like leaving before publish, and invite-then-publish better matches user mental model.
- Decision: Add `create_match_draft` (status `draft`) and `publish_match`. Review creates a draft; invite screen sends invites on draft; **Publish match** transitions draft → `open`. Invited players only see inbox invites after publish. `create_and_publish_match` remains as draft + publish for atomic callers/tests.
- Alternatives considered: client-only publish flag without DB draft state; allowing invite acceptance before publish.
- Consequences: `013_draft_match_publish.sql`; `draft` counts toward one-hosted-match-per-format limit; `list_my_matches` includes drafts for creator.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5 booking UX (RacketPal borrowings, manual request model)

- Status: accepted
- Context: Competitor apps (e.g. RacketPal) emphasise venue directory, favourite clubs, and shortcuts from an organised match toward a court. Lebanese pilot clubs are unlikely to expose real-time inventory or in-app payments in v1. PRD already requires manual club accept/reject/alternative.
- Decision: M5 delivers a **rich club directory**, **favourite clubs**, and a hub **Request court** shortcut when `ready_to_book`, wired to **manual booking requests** and the E8 staff queue. **Pay at club** is informational copy only. **Pilot club onboarding** uses a structured dashboard form, not venue API integration. **Chat-first venue coordination** stays out of M5; M6 match chat supplements coordination but does not replace booking RPCs.
- Alternatives considered: Playtomic-style instant book and payment; chat-only coordination like early RacketPal flows; deferring directory polish until post-pilot.
- Consequences: `docs/ROADMAP.md` M5/M6 scope and borrowed-UX table updated; implementation must not add payments or guaranteed inventory in M5.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5.1 booking RPCs and creator-only request

- Status: accepted
- Context: First vertical slice for E5 needs DB-enforced booking without a club dashboard UI yet.
- Decision: Add `014_bookings.sql` with alternative columns, `player_favorite_clubs`, and RPCs (`request_match_booking`, staff accept/reject/propose alternative, player respond/cancel). **Only the match creator** may request a court. Match transitions: `ready_to_book` → `booking_pending` → `confirmed` (accept) or back to `ready_to_book` (reject/cancel/decline alternative). Hub `next_action` values: `request_court`, `awaiting_club`, `review_alternative`, `pay_at_club`. Club dashboard UI deferred to M5.2; staff actions verified via DB tests with seeded club staff.
- Alternatives considered: any accepted participant can request; building dashboard queue in the same slice.
- Consequences: mobile hub CTA + `/match/[id]/book` + `/clubs` screens; staff queue pages still pending.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5.2 club dashboard booking queue

- Status: accepted
- Context: M5.1 delivered player booking RPCs and staff mutations tested via SQL; E8 requires a staff UI for accept/reject/alternative.
- Decision: Add `015_club_bookings_queue.sql` with `list_staff_clubs`, `list_club_booking_requests`, and `get_club_booking_detail`. Dashboard routes: `/login`, `/bookings`, `/bookings/[id]` with password sign-in for local dev (seeded club staff). Hours/prices/blocks editors remain a follow-up within M5.2.
- Alternatives considered: magic-link-only auth for staff; server-side SSR session via `@supabase/ssr` in the first slice.
- Consequences: end-to-end manual booking loop testable from mobile request through dashboard response; club admin configuration UI still pending.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5.2 club admin onboarding and configuration

- Status: accepted
- Context: M5.2 booking queue shipped; clubs still needed self-serve profile/court/hour setup for pilot onboarding.
- Decision: Add `016_club_admin.sql` with `register_pilot_club`, admin detail/profile/court/hour RPCs, and staff block RPCs. Dashboard routes: `/onboarding`, `/settings`, `/courts`, `/hours`. One club admin per user in v1; new clubs are active immediately in local pilot (platform review can be added later).
- Alternatives considered: platform-admin-only club creation; mobile club onboarding.
- Consequences: M5.2 complete; M6 chat/notifications is next milestone.
- Owner: Founder/technical reviewer

## 2026-07-26 — M5.3 optional WhatsApp booking mode

- Status: accepted
- Context: Lebanese pilot clubs often prefer WhatsApp for court booking. Schema already had `booking_mode = external_link` and `club_private_contacts.booking_phone`, but no admin UI or player flow.
- Decision: Clubs may opt into **WhatsApp booking** (`external_link`) with a private booking phone configured in dashboard settings. Players see **Book on WhatsApp** (not the raw number) on club detail and match booking screens; tapping fetches a server-built `wa.me` payload with prefilled match context. In-app `manual_request` flow remains default and unchanged.
- Alternatives considered: showing phone in directory cards; replacing in-app booking entirely; chat-first coordination only.
- Consequences: `017_whatsapp_booking.sql`; no audit trail for WhatsApp-only clubs; match status stays `ready_to_book` until players confirm offline.
- Owner: Founder/technical reviewer

## 2026-07-26 — M3.5 P1 stale match expiry and extend

- Status: accepted
- Context: Open matches without activity should not linger forever in discovery. `docs/LIFECYCLE.md` defines 7-day listing cap and 24h grace after proposed times.
- Decision: Add `listing_extended_at`, `expire_stale_matches()` (service-role job), `extend_match_listing()` (**Still looking?** for creators), stale warnings on `list_my_matches` and `get_match_hub`.
- Alternatives considered: auto-expire without warning; chat-only nudges without extend action.
- Consequences: `018_match_expiry.sql`; reminder notifications deferred to M6 P2.
- Owner: Founder/technical reviewer

## 2026-07-26 — M6.1 match participant chat

- Status: accepted
- Context: E6 requires participant-only chat supplementing the structured match flow from M5.
- Decision: RPCs `list_match_messages` and `send_match_message` with accepted-participant gate, 60 messages/hour rate limit, RLS select for Realtime, hub chat panel with live inserts.
- Alternatives considered: chat-first booking; polling-only without Realtime.
- Consequences: `019_match_chat.sql`; push notifications and notification outbox remain M6 follow-up.
- Owner: Founder/technical reviewer

## 2026-07-27 — M6.2 Expo push token registration

- Status: accepted
- Context: M6 requires device token storage before the notification outbox worker can deliver push messages.
- Decision: RPCs `register_device_push_token` and `deactivate_device_push_token` with authenticated upsert per user/device, token reassignment deactivates prior rows, mobile sync on permission grant/app resume, and deactivate on sign-out. Onboarding notifications screen requests OS permission before continuing.
- Alternatives considered: direct table writes from the client; deferring registration until the outbox ships.
- Consequences: `020_push_tokens.sql`; notification outbox and deep links remain M6.3+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M6.3 notification outbox and deep links

- Status: accepted
- Context: M6 requires deduplicated push delivery and deep links before pilot reminders and invite notifications can ship reliably.
- Decision: Add `enqueue_notification`, `claim_due_notifications`, delivery state RPCs, `schedule_stale_match_reminders` + expired-match enqueue in `expire_stale_matches`, targeted invite enqueue in `create_match_invite`, `process-notifications` Edge Function for Expo delivery, and mobile notification deep-link routing.
- Alternatives considered: client-side polling for invites only; direct Expo calls from mobile without outbox.
- Consequences: `021_notification_outbox.sql`; cron must call `run_notification_jobs` then `process-notifications`; booking nudges and attendance prompts remain later M6/M7 slices.
- Owner: Founder/technical reviewer

## 2026-07-27 — M6.4 lifecycle scheduled jobs

- Status: accepted
- Context: `docs/LIFECYCLE.md` requires `confirmed → in_progress` transitions and booking-timeout nudges; M6.3 outbox existed but cron and lifecycle RPCs were not wired.
- Decision: Add `start_in_progress_matches`, `booking_stale_reminders` (4h club nudge / 24h participant notice), extend `run_notification_jobs`, register `pg_cron` schedules for SQL jobs, and have `process-notifications` invoke lifecycle RPCs before claiming due notifications.
- Alternatives considered: client-only status display; separate edge functions per job.
- Consequences: `022_lifecycle_jobs.sql`; production must also schedule `process-notifications` via `pg_net` + Vault (attendance prompts remain M7).
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.1 result workflow and idempotent rating

- Status: accepted
- Context: North-star metric requires mutually confirmed results with server-side rating; schema existed but no RPCs or client flow.
- Decision: Add `record_match_attendance`, `submit_match_result`, `confirm_match_result`, `dispute_match_result`, and `apply_rating_for_result` (Elo v1, K=32, singles only); extend `match_hub_card` with `result` and `viewer_attendance`; mobile hub panel for attendance and result actions.
- Alternatives considered: client-side rating math; attendance-only match completion.
- Consequences: `023_match_results.sql`; admin dispute resolution and attendance notification jobs remain M7.2+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.2 attendance prompt notifications

- Status: accepted
- Context: Participants need a timely nudge to record attendance and move toward result submission after a match starts (`docs/LIFECYCLE.md` `open_attendance_window`).
- Decision: Add `schedule_attendance_prompts` to enqueue deduplicated `attendance_prompt` notifications for accepted participants with `attendance = unknown` on `in_progress` matches past booking start; wire into `run_notification_jobs` and a 15-minute `pg_cron` schedule.
- Alternatives considered: client-only hub banners without push; repeating reminders without deduplication keys.
- Consequences: `024_attendance_prompts.sql`; custom score entry and admin dispute queue remain M7.3+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.3 custom score entry

- Status: accepted
- Context: M7.1 submitted a fixed placeholder score; players need to enter real set scores before confirming results.
- Decision: Add domain-side tennis set validation (winner-perspective sets, 6-4 / 7-6 style), a match hub score editor (winner pick + 1–5 sets), and display formatted scores on the hub card.
- Alternatives considered: free-text score field; server-side tennis rule engine in SQL.
- Consequences: mobile `MatchResultPanel` and `packages/domain/src/results.ts`; admin dispute queue remains M7.5+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.4 provisional vs earned rating display

- Status: accepted
- Context: Rating v1 requires hiding precise numbers until five confirmed results while still showing skill bands (`docs/DATABASE.md`).
- Decision: Add `display_rating` to public player cards (null while provisional), shared domain/mobile formatting helpers, and own-profile progress (`count/threshold`) until earned.
- Alternatives considered: show internal rating everywhere from day one; hide all level information until earned.
- Consequences: `025_provisional_rating_display.sql`; admin dispute queue remains M7.5+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.5 admin result dispute queue

- Status: accepted
- Context: Disputed results must be reviewable by platform operators without database access (`docs/PRD.md`, `docs/FLOWS_AND_SCREENS.md`).
- Decision: Add `list_disputed_results` and `resolve_match_result_dispute` (confirm applies rating + audit; void resolves without rating); expose `/admin/disputes` in the dashboard for platform operators only.
- Alternatives considered: email-only ops workflow; auto-resolve after timeout.
- Consequences: `026_result_dispute_resolution.sql`; completed matches tab remains M7.6+.
- Owner: Founder/technical reviewer

## 2026-07-27 — M7.6 completed match history

- Status: accepted
- Context: Players need to see finished matches after the north-star loop completes (`docs/FLOWS_AND_SCREENS.md`).
- Decision: Add `list_my_completed_matches` RPC and a **Completed** segment on the mobile Matches tab showing opponent, score, club, and result status.
- Alternatives considered: fold completed rows into Active; separate profile-only history screen.
- Consequences: `027_completed_matches_list.sql`; active list RPC unchanged.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.1 user report and moderation queue

- Status: accepted
- Context: MVP requires report/block flows and an admin queue with audit trail (`docs/PRD.md`, `docs/TESTING_SECURITY.md`).
- Decision: Add `submit_user_report`, `list_open_user_reports`, and `resolve_user_report` RPCs; mobile player report screen; dashboard `/admin/reports` for platform operators. Enforce one report per reporter/target per day.
- Alternatives considered: direct table inserts from clients; email-only reporting.
- Consequences: `028_user_reports_queue.sql`; block flow unchanged from M2.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.2 pilot cancellation and no-show policy

- Status: accepted
- Context: Pilot clubs need predictable leave/cancel/withdraw rules tied to reliability (`docs/LIFECYCLE.md`).
- Decision: Use a configurable 24-hour late-cancel window (`platform_policy_settings.late_cancel_hours`); classify withdrawals as `cancelled_in_time` or `late_cancel`; extend `leave_match` and `cancel_match`; add `withdraw_from_booked_match` for non-creator exits from confirmed matches; require reasons when cancelling after full or withdrawing from booked matches.
- Alternatives considered: fixed no-penalty until match start; club-specific policies per venue.
- Consequences: `029_cancellation_policy.sql`; mobile cancel/withdraw screens with localized `matches.policy.*` copy.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.3 performance and accessibility review

- Status: accepted
- Context: Pilot release gates require usable touch targets, screen-reader labels, dynamic type, and acceptable list performance on discovery (`docs/TESTING_SECURITY.md`).
- Decision: Virtualize discover card lists via `Screen.virtualizedList`, add composite accessibility labels on shared cards, label tabs/chips/toolbars, export `PILOT_CRITICAL_FLOWS` for manual RTL/a11y regression, and improve dashboard login input semantics.
- Alternatives considered: defer virtualization until post-pilot; rely on manual QA only without a flow registry.
- Consequences: no product-rule changes; matches tab remains scroll-mapped for now due to heterogeneous row actions.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.4 pilot operations guide

- Status: accepted
- Context: Milestone 8 exit requires rehearsed partner-club workflows and documented test identities without SQL access (`docs/ROADMAP.md`, `docs/TESTING_SECURITY.md`).
- Decision: Add `docs/PILOT_OPERATIONS.md` with seeded accounts, club references, five workflow rehearsals, and admin escalation paths; export `PILOT_WORKFLOW_REHEARSALS` aligned with `PILOT_CRITICAL_FLOWS`.
- Alternatives considered: wiki-only ops notes; ad-hoc Slack runbook.
- Consequences: placeholder zones/clubs still must be replaced before public pilot; backup/restore drill remains separate.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.5 Arabic copy review for critical flows

- Status: accepted
- Context: Milestone 8 requires full Arabic translation on critical paths, not just RTL scaffolding (`docs/ROADMAP.md`, `docs/TESTING_SECURITY.md`).
- Decision: Add `critical-flow-keys` CI checks (stale placeholder markers, Arabic script on critical keys), remove obsolete `leavePolicyPlaceholder` keys, fix remaining untranslated availability copy, and expose `/rtl-check` from Settings for manual RTL rehearsal.
- Alternatives considered: manual spreadsheet only; blocking release on professional translator review (deferred to pre-public pilot).
- Consequences: dashboard Arabic copy remains out of critical-flow scope; founder should still proofread Arabic UX before go-live.
- Owner: Founder/technical reviewer

## 2026-07-27 — M8.6 staging checklist and backup drill

- Status: accepted
- Context: Milestone 8 exit requires rehearsed backup/restore and a staging-to-production promotion checklist (`docs/ROADMAP.md`, `docs/TESTING_SECURITY.md`).
- Decision: Add `docs/STAGING_CHECKLIST.md` and `docs/BACKUP_RESTORE.md`; automate CI-equivalent gates via `pnpm verify:pilot`; add `pnpm drill:backup` for local data round-trip + `db:test` after restore.
- Alternatives considered: wiki-only checklist; relying on Supabase dashboard docs without a repo-local drill script.
- Consequences: hosted staging restore still requires manual Supabase project steps; drill script needs Docker + `psql` locally.
- Owner: Founder/technical reviewer

## 2026-07-29 — M8.7 match lifecycle hardening (audit reconciliation)

- Status: accepted
- Context: Cross-audit reconciliation (Cursor + Claude, July 2026) found a cancelled match could return to `confirmed` when a club alternative survived `cancel_match`, and `leave_match` could race with `request_match_booking` because only the booking path held a row lock.
- Decision: Add `030_match_lifecycle_hardening.sql` with `assert_match_roster_full`; harden `leave_match` (`FOR UPDATE`, reject creator leave); include `alternative_proposed` in `cancel_match` booking cleanup; guard `accept_booking` and `respond_booking_alternative` accept with `match.status = 'booking_pending'`; add `withdraw_booking_alternative` for club staff; move CI format check after lint/typecheck/test so formatting cannot mask regressions.
- Alternatives considered: roster guard only without row lock (insufficient — race remains); club-side-only sweeper for stale alternatives without an explicit withdraw RPC (leaves staff queue blocked until expiry).
- Consequences: new stable errors `match_roster_incomplete` and `creator_should_cancel_match` for client mapping; pgTap coverage in `030_match_lifecycle_hardening_test.sql`.
- Owner: Founder/technical reviewer

## 2026-08-14 — Notification delivery repaired end to end

- Status: accepted
- Context: Notifications were broken at three independent points, each failing silently. (1) No Expo project id existed anywhere in the repo, so `getExpoPushTokenAsync` was never called, `device_push_tokens` stayed empty for every user, and every notification was parked as `no_delivery_channel`. (2) Nothing invoked the `process-notifications` Edge Function; `pg_cron` ran only the database-side enqueue jobs, so `sent_at` was never set — already recorded as a hard gate in `docs/STAGING_CHECKLIST.md` §7b. (3) The permission prompt existed only in onboarding, so anyone who tapped "Not now" had no in-app way to turn notifications on, and Settings offered no preferences at all. Because the notification centre lists only rows with a non-null `sent_at`, all three were invisible from inside the app.
- Decision: Read `extra.eas.projectId` from `EAS_PROJECT_ID` via a new `apps/mobile/app.config.ts`, and report a missing id to Sentry once per session instead of returning null. Add `060_process_notifications_invoker.sql`: `invoke_process_notifications()` posts to the Edge Function using Vault-held URL and service role key, scheduled by `pg_cron` every five minutes and inert (a notice, not an exception) until both secrets exist. Add a `/profile/notifications` settings screen exposing OS permission state, an enable prompt, and a system-settings deep link when already denied, with the state machine in `src/lib/push-settings.ts`. Rename `app/(onboarding)/notifications.tsx` to `enable-notifications.tsx` so it stops resolving to the same `/notifications` URL as the notification centre.
- Alternatives considered: committing the service role key into the migration (a secret in version control, and wrong per environment); an external scheduler such as GitHub Actions (adds a second system to keep alive for a job Postgres can run); per-kind notification toggles (needs a new table and a product decision — deferred, the OS-level switch is what "off" means today); hard-coding the Expo project id in `app.json` (blocks separate dev/staging/production Expo projects).
- Consequences: Delivery still requires two operator steps that code cannot do — set `EAS_PROJECT_ID` for the build, and create the two Vault secrets per environment. Both are now checklist items in `docs/STAGING_CHECKLIST.md` §7b with verification queries. Club staff remain unreachable by push (they have no mobile app); that channel decision is still open. Push payload titles and bodies are still built in English in `supabase/functions/_shared/notifications.ts` and are not localized per recipient.
- Owner: Founder/technical reviewer

## 2026-08-14 — Notifications speak the recipient's language, and the roster/chat events fire

- Status: accepted
- Context: Two gaps remained once delivery itself was repaired. (1) Every notification was English in all three languages. Each of the 21 `enqueue_notification` sites built its copy as a SQL literal, and both renderers preferred that literal over their own translations, so the `notifications.kinds.*` strings in `packages/i18n` were never rendered at all — dead code, and the French set was still untranslated English. Only 6 of the 12 enqueued kinds were even registered in `NOTIFICATION_KINDS`; the rest rendered by accident. (2) `join_match`, `accept_match_invitation`, `respond_to_join_request`, `leave_match`, `withdraw_from_booked_match` and `send_match_message` enqueued nothing, so a player joining, a player dropping out of a booked match, and a new chat message were all silent.
- Decision: Register all 15 kinds and add en/ar/fr copy for the 9 that lacked it. Both renderers now key off `kind` and consult the payload literal only for a kind they do not recognise. Push copy needs a server-side locale, so `061_localized_notifications.sql` adds `profiles.notification_locale`, a `set_own_notification_locale` RPC, and a `locale` column on `claim_due_notifications`; the mobile app mirrors its language on sign-in and on change. The three kinds whose copy interpolates values (`court_first_roster_short`, `match_played_prompt`, `match_court_released`) now also send structured `params`, with `startsAt` as UTC ISO rendered in `Asia/Beirut` per locale by each surface. Join, leave and chat notifications are added as AFTER triggers on `match_participants` and `match_messages` rather than edits to the six RPCs, so every path is covered at once; both use a 15-minute dedup bucket over the existing `deduplication_key` unique constraint for throttling. Chat notifications never carry the message body.
- Alternatives considered: rewriting all 21 enqueue sites to drop their literals (a large refactor mixed into new behaviour, requiring a dozen big functions to be redefined — rejected; the literals stay as fallbacks); editing the six RPCs directly instead of triggers (misses future join paths and rewrites booking logic to add a notification); leaving push English and localizing only the in-app list (the push banner is what people see first); notifying only the host on roster changes (the other players are the ones who would have to find a replacement); one notification per chat message (a four-player back-and-forth becomes a dozen pushes).
- Consequences: Push copy is duplicated between `packages/i18n` and `supabase/functions/_shared/notification-copy.ts`, because the Edge Function cannot read the app's i18n bundle at runtime and importing across the monorepo into the Deno bundle is fragile at deploy time. The duplication is guarded by a parity test, which lives in `apps/mobile` because `packages/i18n` and `packages/domain` both pin `rootDir` to their own `src` and cannot reference a file under `supabase/`. `buildExpoPushMessages` was removed from `packages/domain`: nothing called it but its own test, and it had silently diverged into an English-only copy of the real implementation. A kind enqueued without catalogue copy still falls back to the English literal rather than failing loudly. `pnpm db:types` should be run after migration 061 is applied locally; no client code depends on the regenerated types today.
- Owner: Founder/technical reviewer

## 2026-08-14 — Grant players read access to their own notifications

- Status: accepted
- Context: The notification centre had never loaded, on any platform, showing "We could not load your notifications." instead of an empty list. Migration 001 created `notifications`, enabled RLS, and added the `notifications_read_own` policy, but never granted `SELECT` to `authenticated`. An RLS policy filters rows; it does not confer table privileges, so PostgREST was rejected with `42501 permission denied for table notifications` before the policy was ever evaluated. This survived review because the policy is present in 001 and reads as complete, and survived use because almost every other client read goes through a security-definer RPC, which bypasses table privileges entirely. `listUserNotifications` is one of the few direct `.from()` reads in the codebase, and an audit of all seven directly-read tables found `notifications` was the only one missing its grant.
- Decision: Add `062_notifications_read_grant.sql` granting `SELECT` on `public.notifications` to `authenticated`. Reads only — marking read stays behind `mark_notification_read`, and no client role may insert, update or delete: the outbox is written by `enqueue_notification` and the delivery jobs.
- Alternatives considered: converting `listUserNotifications` to a security-definer RPC to match the prevailing pattern (larger change, and the direct-read-plus-grant pattern is already established for `profiles`, `player_profiles`, `zones`, `player_zones`, `availability_windows`, `user_blocks`, `match_messages` and `match_activity`); granting to `anon` as well (rejected — the RLS policy is `to authenticated`, and signed-out callers have no business reading notifications).
- Consequences: pgTAP coverage in `062_notifications_read_grant_test.sql` asserts the grant exists, that `anon` still cannot read, that write privileges are absent, and — the point that matters — that the grant does not expose another player's rows, since RLS remains what confines the read.
- Owner: Founder/technical reviewer

## 2026-08-15 — Platform operators can retire a club (soft delete, not DELETE)

- Status: accepted
- Context: There was no way to take a club down once `register_pilot_club` (050) had brought it live — the only lever on `clubs.is_active` was `review_pilot_club`, and it refuses to touch a club that has already been approved. Since this is an ops-run marketplace with no club-side app (050's framing), "delete a club" always means an operator acting on a club's behalf, not the club itself.
- Decision: Add `065_deactivate_club.sql` with `deactivate_club`/`reactivate_club`, restricted to platform operators (`assert_platform_operator`), flipping `clubs.is_active` rather than deleting the row — every player-facing read already gates on that column (RLS, discovery, every booking-creation path), so it disappears the club everywhere without touching courts, bookings, or history. Refused while the club has a booking in `requested`, `alternative_proposed`, or `accepted` status, so a hidden club can't strand a booking mid-flight with no queue and no notice. Logged to `audit_events` with an optional operator-supplied reason. Surfaced in the dashboard as a "Danger zone" section on `/settings`, gated to `activeClub.role === "operator"` — a club's own admin keeps running their club day to day but does not get to take it offline platform-wide.
- Alternatives considered: hard `DELETE` (rejected outright — CLAUDE.md's rule against destructive deletion of operational records, and `courts`/`club_memberships` cascade-delete on `clubs`, which would also orphan any historical booking pointing at those courts); letting a club's own admin deactivate their own club (rejected per explicit product decision — matches the existing asymmetry where only an operator can approve/reject a club in the first place); no open-booking guard (rejected — would silently stop a club from ever seeing a booking already in its queue).
- Consequences: The schema still has no separate "pending approval" flag, so `reactivate_club` on a club nobody has reviewed yet also brings it live (logged as `club_reactivated` instead of `club_approved`) — a blurred audit label, not a wider power, since only a platform operator could reach either path. `ClubSwitcher`'s inactive-option copy changed from "(awaiting approval)" to "(inactive)" for the same reason: `is_active = false` no longer means only "pending." pgTAP coverage in `065_deactivate_club_test.sql`.
- Owner: Founder/technical reviewer
