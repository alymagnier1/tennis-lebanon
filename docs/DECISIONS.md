# Architecture and Product Decisions

Record decisions using this template:

## YYYY-MM-DD — Decision title

- Status: proposed | accepted | superseded
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Owner:

## 2026-08-28 — A player cannot join an hour they have already agreed to

- Status: accepted
- Context: Nothing anywhere checked for a time conflict. `hosted_match_cap` counts hosted matches and stops at three; `032_discovery_overlap` is about availability in discovery. So one player could hold three matches at 19:00 on Thursday, and — not noticed until a second Phase 0.3 pass — could also **join** several matches that overlap each other. Every one of those is a no-show waiting to happen, and no-show rate is this pilot's counter-metric. Recorded as finding 10 in `docs/COHORT_A_REHEARSAL_FINDINGS.md`.
- Decision: `090_match_time_conflicts.sql` refuses a join whose agreed hour overlaps one the player has already agreed to, raising the stable error `match_time_conflict`. Hosting is warned about in the client rather than blocked. Only **agreed** times count — `selected_time_option_id`, which a fixed match carries from publish and a flexible one gets when a slot goes unanimous. Only `accepted` participations in live matches count as commitments. Overlap is half-open, so a match ending at 20:00 and one starting at 20:00 do not collide. `viewer_agreed_time_conflicts` exposes the same rule to the client, so the thing that blocks and the thing that explains cannot drift.
- Alternatives considered: blocking hosting too (rejected — a host offering the same evening across two listings is recruiting, not double-booking; they will play at most one and which one is not decided yet); counting proposed times as well as agreed ones (rejected — that is exactly the recruiting pattern above, and would block it); keying the rule on venue as well as time, which is how the problem was first described (rejected — two hosts wanting courts at the same club at the same hour is ordinary demand, the booking overlap constraint already protects the court itself, and a player cannot be in two places at once regardless of where those places are); warning on both paths and blocking neither (rejected — it leaves the no-show path fully open, which is the thing worth preventing).
- Consequences: Three existing pgTAP fixtures (`007`, `014`, `022`) started failing, because they created every fixture match in one shared slot and had the same joiner join several of them — the rule caught its first genuine double-booking inside the test suite. Each now draws a distinct hour from a temp sequence. **Two gaps remain open by design.** The create-side warning is not built, so hosting is currently neither blocked nor warned about; and a `requested` row is not a commitment, so two pending requests at the same hour are both allowed until one is accepted — the second join then fails at accept time rather than at ask time, which is the right trade but is not nothing.
- Owner: Founder

## 2026-08-28 — A superseded decision outranked its replacement for three weeks

- Status: accepted
- Context: The 2026-07-28 entry shipped the pilot in English and French only, because `I18nManager.forceRTL` was not wired and Arabic strings would have rendered inside an LTR layout. Nine days later the 2026-08-06 entry wired `syncNativeLayoutDirection`, re-added `ar` to `PILOT_LOCALES`, and superseded it. The older entry kept `Status: accepted`, and nothing swept the documents that cited it. Three weeks on, four documents still asserted EN/FR-only: Phase 0.6 and two other rows in the launch checklist, and — worst — `PHASE_0_MANUAL_REHEARSAL_GUIDE.md`, which flagged the one correct line in `PILOT_OPERATIONS.md` as a "known doc inconsistency" and told the reader to ignore it. `CLAUDE.md` precedence ranks documents against each other but says nothing about how two entries in this log rank, so a reader searching for "Arabic" stopped at the first hit and got the reversed answer. This is the same failure the 2026-08-27 cohort-1 audit caught with PRD §7, one level down.
- Decision: A superseded entry gets `Status: superseded by <entry>` at the moment its replacement is accepted, naming the replacement rather than only the date. The propagation sweep — every document citing the old decision — belongs to the superseding change, not to a later cleanup. Corrected here: `PILOT_OPERATIONS.md` critical-flow smoke now names all three of `PILOT_LOCALES`; launch checklist 0.6, 7.7 and the physical-device smoke now say English, French and Arabic; the rehearsal guide's inverted note is replaced with what is actually true.
- Alternatives considered: deleting the superseded entry (rejected — it loses why the constraint was real, and a future reader wondering why Arabic was ever withheld would have to reconstruct it); relying on entry dates alone to signal precedence (rejected — that is exactly what failed, because readers grep for a topic and stop at the first match rather than reading the log in order); a single locale constant the docs could cite instead of restating (rejected — Markdown cannot import `PILOT_LOCALES`, so the duplication is unavoidable and the fix has to be process).
- Consequences: Phase 7.7 changes from a spot-check of a locale believed hidden into a real Arabic RTL device pass. That is a gate, not a formality: the 2026-08-06 entry re-enabled Arabic on the strength of critical flows and says in its own consequences that secondary screens may still need a device pass. Nobody has walked Arabic on a device since, and while four documents claimed Arabic was out of scope for cohort 1, nobody was going to. The 2026-07-28 entry keeps its body; only its status changed.
- Owner: Founder

## 2026-08-28 — Cancelling a match tells the other players, and the reason lives on the hub

- Status: accepted
- Context: `cancel_match` (030) has compelled the host to give a reason ever since the cancellation policy landed, writes it to `matches.cancellation_reason`, and stops there. No notification kind existed for cancellation, `get_match_hub` never returned the column, and `list_my_matches` excludes cancelled matches — so the match simply vanished from the other player's list with no word. That is the same shape as the silent decline `077` fixed, and it lands on the metric this pilot watches most closely: a player who never learns a match was called off is a no-show. Found in the Phase 0.3 rehearsal and recorded in `docs/COHORT_A_REHEARSAL_FIXES.md`.
- Decision: Add `089_notify_match_cancelled.sql`. Enqueue from a trigger on `matches` keyed on the transition into `cancelled`, fanning out through `notify_match_participants` so whoever cancelled is excluded. Register a `match_cancelled` kind in all four places a kind has to exist — `NOTIFICATION_KINDS`, the en/ar/fr `notifications.kinds.*` bundles, and the Edge Function's `notification-copy.ts`. Add `cancellation_reason` to the `match_hub_card` composite and render it on the hub as a `critical` banner rather than the `actionable` tone the primary banner previously hard-coded. Separately, warn a host at creation when they advertise a zone that none of their chosen clubs sit in.
- Alternatives considered: enqueueing inside `cancel_match` (rejected — `withdraw_from_booked_match` (034) also writes `status = 'cancelled'`, and the 2026-08-21 entry chose triggers over RPC edits for exactly this reason: an enqueue in one RPC misses every other path into the same state); putting the host's reason in the push body (rejected — `NotificationParams` carries only structured values that each surface renders in the recipient's language, a host-authored string cannot be localized, and free text on a lock screen would transit Expo's servers; the reason is one tap away instead); narrowing a match's zone list to only zones holding a chosen club (rejected — silently rewrites what the host chose, and would change how already-published matches read); warning on every zone when no club is picked at all (rejected — clubs are required for `public` matches only, so an `invite_only` host with no club has made no mistake).
- Consequences: After a cancel the hub is unreachable from the Matches tab — `exitMatchHub` runs and `list_my_matches` filters cancelled rows — so the notification is the only route to the reason. That resolves because `get_match_hub` authorises any participant whose row is still `accepted` and `cancel_match` demotes nobody, but it does mean a player with notifications off never sees the reason at all. The 15-minute dedup bucket is inert here, since a match cancels once; it is kept for shape consistency with the other enqueues. Nothing is delivered until the Vault secrets from `060` exist, so the push half is verifiable on staging rather than locally, while the hub banner works immediately. pgTAP coverage in `089_notify_match_cancelled_test.sql`. **A player removed by the host is still never told** — `match_participant_left` excludes the removed player, the same shape as this bug, and remains unaddressed.
- Owner: Founder

## 2026-08-27 — Cohort-1 ops owner, support inbox, and escalation SLA

- Status: accepted
- Context: Phase 0.7 of the launch checklist asks for a named ops owner and a single support inbox, and had never been answered. Nothing in the repo held a real address: the legal drafts point at "the official in-app support path" without naming one, and `.env.example` carried the placeholder `support@tennis-lebanon.invalid`. The gap was not visible locally because `packages/config/src/env.ts` only rejects a `.invalid` address once `APP_ENV` is not `local` — so it would have surfaced as a failed staging build at Phase 6.3 rather than as a missing decision.
- Decision: Ali Moghnieh is the cohort-1 ops owner, covering `/admin/reports`, `/admin/disputes`, and matches that agreed a time but never recorded a court. The support inbox is `aly.magnier@gmail.com`, **explicitly temporary**. Escalation splits the previously uniform 48h suggestion: open reports clear within 24h because they are a safety path, disputed results within 48h. Club operations sign-off in the go-live table is marked not-applicable for cohort 1, since no club takes part.
- Alternatives considered: buying a domain for a `support@` address now (rejected — the product name is still an open founder decision per `README.md`, so the domain could be the wrong one, and the address is a config value that costs one env var to change); a shared team inbox (rejected — no team at 50 players); keeping the uniform 48h SLA (rejected — a safety report and a scoring disagreement do not deserve the same clock).
- Consequences: `.env.example` deliberately keeps `support@tennis-lebanon.invalid`. Local development never needs a real support address, and the `.invalid` default is a working tripwire that makes a misconfigured non-local build fail loudly. The real value belongs in EAS and Vercel environment settings at Phases 1 and 6, not in the repository. Because the address ships inside the app binary and on the store listing, replacing it after cohort B requires a rebuild — cheap at 50 players, so the temporary address is acceptable for cohort 1 but should be settled before any public release. Phase 0.7 is now answered; Phase 0 still waits on the 0.3 workflow rehearsals.
- Owner: Ali Moghnieh

## 2026-08-27 — Cohort-1 pilot bar is separate from the full-pilot bar

- Status: accepted
- Context: `CLAUDE.md` ranks `docs/PRD.md` above the launch checklist, so PRD section 7 outranked the accepted 2026-08-19 decisions that no club is a partner in cohort 1 and that club response time is unmeasurable while booking runs on the club's own WhatsApp. Those decisions corrected the launch checklist and propagated nowhere else, leaving eight documents asserting a stale bar. `PILOT_OPERATIONS.md` also contradicted itself: line 40 says no club takes part, and the pre-pilot blocker list demanded founder sign-off with real club staff.
- Decision: PRD section 7 is the full-pilot bar; `PILOT_50_PLAYER_LAUNCH.md` now carries a cohort-1 bar for 50 players in the single `beirut` zone. The club-response guardrail is replaced everywhere with court-request conversion (WhatsApp handoff opened to court confirmed), the proxy migration `070` already records, with its own threshold left to a baseline rather than guessed. The 5–8 partner-club target is annotated as a multi-city, post-cohort ambition rather than deleted. Fill rate resolves to 40% pass and 50% healthy. The liquidity-signal empty rate is recorded with the threshold deliberately unset until cohort A produces a baseline. Cohort A recruiting weights to Improving / Intermediate / Advanced with Intermediate largest, because `DEFAULT_LEVEL_WINDOW` is 1 and the edge bands cannot reach each other.
- Alternatives considered: leaving PRD untouched and overriding only in the launch doc (rejected — precedence keeps the stale bar winning); deleting the 5–8 target outright (rejected — unproven outside Beirut, and the full pilot may add Keserwan); setting a liquidity-empty threshold now (rejected — no baseline exists, so any number is a guess wearing a threshold's clothes); restricting cohort A to two adjacent bands (rejected — the plus-or-minus-one window already makes a centred three-band mix workable); promoting the "~5 matches per weekday evening" projection to a threshold (rejected — conflates thin liquidity with players simply playing fortnightly).
- Consequences: Documentation only, no code or schema change. Eight documents updated: PRD, APP_SUMMARY, README, RETENTION_UX_AUDIT, STAGING_CHECKLIST, PILOT_OPERATIONS, PILOT_50_PLAYER_LAUNCH, and this log. Club data-processing terms and the club-staff push-channel decision are marked not-applicable to cohort 1 rather than blocking it. Two gaps are now recorded rather than silently carried: no document states a pilot duration, though the 30-day repeat-play bar implies roughly 30 days past first completions; and the liquidity threshold must be set after cohort A. Phase 7 also gains a throttled-network rehearsal and three past-behaviour questions for signups who never created or joined, the first qualitative instrument in the pilot.
- Owner: Founder

## 2026-08-26 — Hours and clubs are Home next actions in a carousel

- Status: accepted
- Context: First-open Home asked for hours and clubs as a stacked empty under (or instead of) listings. The founder wanted those reminders as next actions, but not a vertical stack of full cards.
- Decision: Missing hours and favourite clubs are derived Home next actions, ranked after live match work and before rematch. Home shows a horizontal snap carousel (one card, peek of the next, dots when there are two or more). A single action stays a plain card. Onboarding stays three screens; Profile still owns the editors. Play is not blocked.
- Alternatives considered: stacked next-action cards (rejected — repeats the first-open empty mess); a combined “when and where” card with two buttons (rejected — hides the second ask); restoring Where I play as an onboarding step (already rejected).
- Consequences: The first-play empty is only organise / Discover when nothing else is queued. Open matches and free players can still list under the carousel.
- Owner: Founder

## 2026-08-26 — First Home asks for hours and clubs, skippable

- Status: superseded
- Context: Hours and favourite clubs help others find you and pre-fill hosting, but a 6-step onboarding that collected them before Home was rejected as setup theater. First-open Home then only asked to organise or Discover, so new players were never called to fill the two profile facts that make them findable.
- Decision: Onboarding stays three screens. When Home has nothing to list, the first empty asks for free hours (primary) and favourite clubs (secondary). Organise remains a text skip. After both exist, the empty becomes organise / Discover. Not a gate: play stays possible immediately.
- Alternatives considered: restoring Where I play as an onboarding step (rejected — already cut); a blocking wizard before Home (rejected — delays the first match); stacking a setup card on top of open-match listings (rejected — repeats the three-empty first-open mess).
- Consequences: Profile still owns the editors (`/profile/availability`, `/profile/where-i-play`). Home open-match ranking keeps using saved hours and clubs when they exist.
- Owner: Founder

## 2026-08-26 — Ethical influence: truthful counts, agency empties, no Welcome crowd number

- Status: accepted
- Context: A Cialdini audit scored the player app 6/10: Welcome had no tribe or honesty about rankings, Complete asked before giving listings, empty states taught “nobody is here,” and Home claimed matches were waiting even when the overlapping list was empty.
- Decision: Welcome stays copy-only (Lebanon + level, no UTR/NTRP). Live counts appear only after sign-in, from `discover_open_matches` overlap and `capacity - participant_count`. Empty states lead with what the player can do. Last-seat and court-held copy are shown only when those facts are true. Complete may gift overlapping open matches before Home.
- Alternatives considered: a public unauthenticated match-count RPC (rejected — extra surface, and Welcome has no zones yet); inventing crowd numbers for a ~300-player pilot (rejected — fake social proof).
- Consequences: Home does not add a second “find tonight” card. Open matches is the listing surface when listings exist. On first open with nothing to list, Home shows organise / Discover only when the next-action carousel is empty. Hours and clubs are carousel pages, not that empty. Discover/Home cards show “1 spot left” only for the last seat.
- Owner: Founder

## 2026-08-26 — Home next action, three-step onboarding, WhatsApp court climax

- Status: accepted
- Context: A Jobs-style review scored the player app 6/10: Home led with rating chrome, first-run detoured through clubs, Discover defaulted to players, and the hub stacked ops around the next action. Pilot court booking stays WhatsApp + `confirm_external_court`.
- Decision: Home shows one derived next action (or “find a match for tonight”). Onboarding is consent → you (identity + tennis) → areas, then Home. Notifications and Where I play stay in Profile. Discover defaults to open matches. Create publishes to the hub (invite from there). Hub above-the-fold is status, roster, the WhatsApp court ritual when ready, and one primary CTA; secondary ops sit in More.
- Alternatives considered: restoring the in-app club queue (rejected for cohort 1); keeping flexible timing on the default create path (left buried in more options); a 6-step onboarding with clubs first-run (rejected — setup theater before liquidity).
- Consequences: Favourite clubs are no longer collected before the first Home. Create still lets a host pick clubs per listing. Rating progress lives on Profile only.
- Owner: Founder

## 2026-08-26 — Invite and join notes, not open DMs

- Status: accepted
- Context: Open DMs from a profile would let players arrange games off the match lifecycle and contradict the participant-only chat rule. Invites and approval-gated join requests still arrived cold — a bare name with no reason.
- Decision: Optional note (≤140 chars) on targeted invites and on approval-gated join requests only. Notes stay out of push notifications; the invite push interpolates the inviter’s display name instead. Instant join stays one tap with no note field. Share-link invites carry no note.
- Alternatives considered: open DMs (rejected — social inbox leak); note in push body (rejected — stranger text on the lock screen); note on every join (rejected — slows the one-tap path).
- Consequences: Migration `088_invite_and_join_notes.sql`. Acceptance lift can be measured by comparing invites/requests with and without notes. Post-pilot, DMs between players who already completed a match remain a separate question.
- Owner: Founder

## 2026-08-23 — Public player profile: challenge in header, safety as text links

- Status: accepted
- Context: Support was a full card with bordered Report/Block buttons, and Challenge sat in a sticky footer, duplicating the reference header CTA.
- Decision: Challenge to match sits in the profile header under the bio. Report and Block are text-only links at the bottom of the page, with no Support card.
- Alternatives considered: keeping a sticky footer for Challenge (rejected — fights the compact header layout); a two-button Chat + Challenge row (rejected — Chat is not a public-profile action).
- Consequences: Blocking still confirms before applying. Safety copy remains an accessibility hint, not visible body text.
- Owner: Founder

## 2026-08-23 — Dark mode follows the olive-charcoal mock, not yellow-black

- Status: accepted
- Context: Dark Home used a yellow-olive canvas (`#0F0E04`, brown cards) and Material violet `#7C3AED`. The product mock is green-charcoal with a lighter lavender.
- Decision: Dark surfaces are `#0D0F0A` canvas, `#1C1E19` cards, `#252722` wells, `#2E322C` borders. Dark primary/violet is `#8B6DFF`. Headings use cool off-white `#F3F4F0`. The tab bar’s selected well in dark is that lavender with a white icon, matching the mock Home pill. Light tokens are unchanged.
- Alternatives considered: keeping the yellow-olive canvas and only brightening violet (rejected — the hue mismatch is the glare); copying the mock’s promo banner and photo match cards (rejected — colour accuracy, not a Home redesign).
- Consequences: dark CTAs, FABs, and join pills pick up `#8B6DFF`. Lime stays on skill-band chips.
- Owner: Founder

## 2026-08-23 — Home shows two open matches that overlap time or place

- Status: accepted
- Context: Home already surfaces free players. Open listings to join were only on Discover, so a player with overlapping time or a preferred club/area had to leave Home to find a game.
- Decision: Home lists at most two public open matches where the viewer's availability overlaps a proposed time, or a preferred club/area matches. Rank time overlap first, then club, then area. "View all" opens Discover on the matches segment. Hide the section when none qualify.
- Alternatives considered: showing the latest two open matches with no overlap filter (rejected — Home would repeat Discover without being more useful); requiring time and place together (rejected — too empty at low density).
- Consequences: `discover_open_matches` still applies its own zone constraint when the viewer has preferred areas, so a club-only listing in another area will not appear until that RPC is relaxed.
- Owner: Founder

## 2026-08-23 — Home uses compact header and violet, not a lime hero

- Status: accepted
- Context: Home's lime full-bleed header and stat boxes made the screen loud and busy. A dark-mode reference used a small avatar+greeting header, text stats, and violet CTAs.
- Decision: Home header sits on the canvas (no lime banner). Matches played and skill band are one text line; rating progress is a bar plus hint, not boxed stats. Quick-action tiles are removed (Discover and Create already cover find/book). Dark-mode primary CTA fill is violet `#7C3AED`; lime stays on skill-band chips. Time chips in "players free this week" are text-only.
- Alternatives considered: keeping the lime hero and only shrinking type (rejected — the fill is the glare); adding the mock's marketing community banner (rejected — not a product surface).
- Consequences: tab-bar FAB in dark mode is violet with the rest of dark CTAs. Light mode still uses forest green as `primary` except Home accents that read `violet`.
- Owner: Founder

## 2026-08-22 — Mobile dark mode uses olive-black surfaces and lime CTAs

- Status: superseded
- Context: the mobile app shipped light-only Figma tokens. Players asked for a dark theme; a profile-screen reference used olive-black canvas, charcoal cards, and a violet primary button.
- Decision: add a persisted Appearance preference (System / Light / Dark) on Settings. Dark surfaces follow that reference (`#0F0E04` canvas, `#22221A` cards). Primary actions stay lime/green (`#C8E63B` fill, dark label) so the mobile brand does not switch to violet. Club dashboard keeps the existing light blue ramp.
- Alternatives considered: violet CTAs from the mock (rejected — splits mobile brand from Figma light and from lime skill-band / actionable tone); dark-only with no light theme (rejected — daytime outdoor use); per-screen restyle without a token switch (rejected — too easy to drift).
- Consequences: superseded on 2026-08-23 — Home glare from lime heroes led to violet CTAs in dark mode. Surfaces and the Appearance setting remain.
- Owner: Founder

## 2026-08-19 — Cohort 1 lists clubs; it does not partner with them

- Status: accepted
- Context: the launch checklist and operations guide were written around onboarding 5–8 partner clubs, a club-staff booking queue, and a per-club playbook. None of that reflects how cohort 1 works. Players find a venue in the app's directory, tap through to the club's own public WhatsApp, book exactly as they would have without the app, and record the court themselves through `confirm_external_court`. Supersedes the framing in the 2026-08-16 court-handoff entry, which described the second half of the funnel as "gated on clubs not yet signed" — there is nothing to sign.
- Decision: **no club is a partner for cohort 1.** The app is a directory plus a coordination layer; the booking is unchanged from what a player would have done anyway. Phase 2 of the launch checklist becomes listing four venues with their published WhatsApp numbers rather than negotiating with eight. The "Club queue (Flow C)" rehearsal is removed — it exercised a path the pilot does not use — and the booking rehearsal is rewritten around the WhatsApp handoff and `confirm_external_court`, which is what cohort A actually depends on and what nothing rehearsed before.
- Alternatives considered: keeping the club-queue rehearsal as insurance (rejected — the in-app queue is already listed as out of scope for cohort 1 because there is no reliable staff notification channel, so rehearsing it spends an evening proving a path nobody will walk; the seeded club keeps it testable if that changes); pursuing partnerships anyway for better court access (rejected for cohort 1 — it makes launch dependent on other people's willingness, and the survey has not been done; supply is already adequate at roughly 6+ courts across the Manara cluster).
- Consequences: no club can block or delay the pilot, and Phase 2 shrinks from 2–5 days to 1–2. The club dashboard is still needed, but only for the operator adding clubs and for `/admin/reports` moderation — not for club staff. Two limits are now explicit in the docs rather than implied: court state is **self-reported**, since `confirm_external_court` records what a player says they booked and nothing checks it against the club, so a double-booking surfaces at the court; and the club's WhatsApp response time is outside the product and unmeasurable from inside it, with the `match_court_requests` tracking from `070` recording only that a player left for WhatsApp. The second half of the funnel therefore measures the handoff — an unanswered message, no free court, or two people who agreed and never went — not a missing partnership.
- Owner: Founder

## 2026-08-19 — Beirut is one zone, and area stays a preference rather than a location

- Status: accepted
- Context: cohort 1 opens in Beirut, with Keserwan as a later possibility, and Phase 0.5 of the launch checklist wanted real zones in place of the `pilot-north/central/south` placeholders. Two questions had to be answered first: how finely to cut the city, and whether picking an area should eventually become a map or GPS feature.
- Decision: **one zone, `beirut`, under `city_code = 'beirut'`.** Zone granularity follows where courts are, not where people live. The bookable supply for cohort 1 is four venues, and three of them — Renaissance Tennis Club, Al Riyadi Beirut Club and JDK Sports Club — sit together at Manara; the fourth is The Private Club in Dekwaneh. Area also stays a **multi-select preference** (`player_zones`, 1–10 entries with priority, already enforced in `set_player_preferred_zones`), not a location fix. Keserwan, when it opens, is new rows under `city_code = 'keserwan'`.
- Alternatives considered: east/west across the municipality (rejected — it would hand east-Beirut players a zone with nothing bookable in it, and would not shorten anyone's journey, since both players drive to Manara either way; it only shrinks the pool the liquidity signal reads from); three zones including the eastern hill suburbs (rejected for cohort 1 — at 50 players that is ~17 each, below the density where an evening block reliably has two people free, and it splits a corridor people already cross); GPS or map-based zone assignment (rejected on two grounds — `CLAUDE.md` forbids exposing or logging precise location, and a coordinate captures where the phone was, not where someone will drive for a 7pm match; a player signs up at home on Sunday and plays near work on Tuesday); one zone per player rather than several (rejected — overlapping preferences are what create the availability overlap discovery depends on, so restricting to one would roughly halve every player's pool).
- Consequences: 50 players sit in a single pool, which is the densest arrangement available and the one under which the liquidity counts actually fire. GPS may still arrive later as a **convenience for input** — pre-ticking the nearest zones on the onboarding screen — without becoming the matching key or storing coordinates; that is additive and needs no schema change. The zones live in `supabase/pilot/beirut-zones.sql` rather than a migration or `seed.sql`: migrations run everywhere including `pnpm db:reset`, and 31 local files reference the placeholder zones by id, so local keeps them as fixtures while staging and production get the real one. Court supply was sized before committing: roughly 6+ courts across the Manara cluster against about five matches per evening for 50 weekly players, so the pilot is coordination-bound rather than court-bound — which is what it should be testing. **The launch checklist's Phase 2.1 target of 5–8 clubs is not achievable in Beirut** and has been corrected: the academies do not rent courts outside lesson hours, and the remaining venues are members-only.
- Owner: Founder

## 2026-08-18 — "5 free" opens onto those five players

- Status: accepted
- Context: the liquidity signal reported how many players were free in a block and offered no way to see who, so the number was a fact nobody could act on — the loop stopped one step short of a match. Discover cannot answer the question either: its availability filter matches players who overlap the viewer's own availability anywhere in a fourteen-day horizon, which is a different question with a different answer, so routing a tap there would have opened a list that disagreed with the number that offered it.
- Decision: `discover_compatible_players` gains optional `p_free_from`/`p_free_to` (migration `075`), applying the same rule `get_availability_liquidity` counts with — at least one contiguous hour inside the block, measured from `greatest(p_free_from, now())` so a block in progress is trimmed to the part still ahead. A new `/free-block` screen lists those players with the existing `DiscoverPlayerCardRow`, so each one carries the Invite action already built. Home's rows navigate there; declaring yourself free moved onto that screen, where it reads better after seeing who is present and leaves the row a single obvious action.
- Alternatives considered: a sibling RPC returning the same card type (rejected — the card select underneath is ~100 lines of zones, availability tags, favourite clubs and overlap slots, and a second copy would drift out of step); sending the tap to Discover with its availability filter on (rejected — cheap, but "5 free" would open onto 8 players or 2, and the number on Home would stop meaning anything); expanding the row inline on Home (rejected — it re-implements a slice of the player card and a busy block would make Home long again, which is what the previous round was fixing); leaving the count unlinked (rejected — that is the status quo the founder challenged, and it is right that a number you cannot act on has no purpose). The extended function was **recreated from the live definition rather than retyped**, with exactly two additions, and dropped first because adding parameters changes the signature — `create or replace` would have left the old eight-argument function in place and made every existing call ambiguous.
- Consequences: the count and the list are equal by construction, and this was verified across every block in the week (5/5, 5/5, 2/2, 5/5). Getting there caught a real mismatch first: the count is zone-scoped to the viewer while Discover's default is not, so the screen passes the viewer's own zones — without that the list ran wider than the count that opened it. Level is deliberately left wide on this screen, because the count does not filter on level either. The existing eight-argument call path is unchanged and was regression-checked positionally, by name as PostgREST sends it, and for overload ambiguity (one function of that name remains). `availability_ping_sent` gains `surface: "free_block"`. Verified live end to end: Friday evening opens five players and reports "from your saved availability" with no add button, since the grid covers it; Sunday evening opens five players with "I am free then too", which writes the window, flips to "I am not free then", and removes it again leaving the other five one-off windows intact.
- Owner: Founder

## 2026-08-17 — Show the week's demand; only ask where the grid is silent

- Status: accepted
- Context: three complaints from the first real use of the "I'm free" section, all fair. It read one-off pings but never the recurring availability grid, so a player whose profile already said "free Wednesday mornings" was asked to declare it again and the tap wrote a second row saying the same thing — of six taps, **three were exact duplicates** of the tapper's own grid (Wed 07:00–12:00, Fri 17:00–22:00, Tue 12:00–17:00). `isSlotAlreadyPinged` returned false for any window without timestamps, which is every recurring window, and a test asserted that as correct ("ignores recurring windows, which carry no timestamps") — the bug was pinned rather than caught. Second, a tap could not be undone from Home, so a mis-tap was permanent unless the player found the availability screen. Third, the section had grown to two headings and six controls on a Home screen already carrying four sections.
- Decision: the section is **"Most players free this week"** — a list of at most three blocks ranked by how many others are free, then by soonest. The chip row is gone; the chips were the crowded, redundant half, since Today and Tomorrow are exactly the blocks a filled-in grid usually covers. `findSlotCoverage` replaces `isSlotAlreadyPinged` and reads both shapes: recurring by weekday plus local-time overlap honouring `valid_from`/`valid_until`, one-off by instant overlap. It returns the window rather than a boolean, so a ping the section may delete can be told from a grid entry it must not. Each row's right-hand side always shows the count, plus a state line: nothing when the player is not free then, "Remove" when a ping covers it, "From your availability" when the grid does — the last being disabled, because removing a grid entry from Home would quietly rewrite the player's usual week.
- Alternatives considered: hiding blocks the player is already free for (**tried and rejected** — the redundancy was about _asking_ a question the grid had answered, not about reporting the week's demand, and "Friday evening, five free, and so are you" is worth knowing; hiding also emptied the section for the very player whose feedback prompted this, since they were already free at every busy time); merging the chips and the count rows into one generic "When are you free?" list (built, then rejected on review — it discarded the labelled heading and the count-on-the-right treatment, which was the part worth keeping); dropping the count rows and keeping chips only (rejected — that loses the week-ahead signal, the only thing that makes declaring worth doing); moving the section to the availability screen (considered seriously, since that is where times are managed, and rejected because Home is where a free evening is noticed); showing "0 free" or "Be first" on an empty block (rejected — under a heading reporting where the demand is, a block with nobody free has no place, so those are simply absent and the section disappears when the week is empty); freezing the window list in a ref so a tapped row survives (unnecessary once rows stopped being coverage-filtered, and the React Compiler lint forbids reading a ref during render anyway).
- Consequences: Home drops from two headings and six controls to one heading and three rows. The count stays put through every state, because it describes the week rather than the player. A tap is reversible: ranking keys on the count and the start, neither of which a player's own window moves, so the row is still there to tap again. Verified live — add shows "Remove", tapping again deletes the window and restores the row, the adjacent grid-covered Friday row stayed disabled throughout, and the player's other five one-off windows were untouched. `availability_ping_sent` now carries `surface: "home"`; the chip/liquidity distinction is void with a single list, so the earlier note about telling those apart no longer applies. Removals are **not** tracked as an event, which would need another allowlist migration — the duplicate rate is measurable from the tables directly, by counting one-off windows that overlap a recurring entry on the same weekday, and driving that to zero is what this change is for.
- Owner: Founder

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

- Status: superseded by the 2026-08-06 entry "Arabic RTL enabled in pilot locales", which re-added `ar` to `PILOT_LOCALES` once `forceRTL` was wired. This entry stood for nine days; several docs kept asserting EN/FR-only for weeks afterwards, so cite the 2026-08-06 entry rather than this one.
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

- Status: superseded by the 2026-08-22 entry "Players choose their own skill band"
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

## 2026-08-21 — A request to join an approval-required match notifies the host, and only the host

- Status: accepted
- Context: `matches.requires_creator_approval` has worked end to end since M2 except for the one step that makes it usable. `join_match` writes a `requested` participant row, `get_match_hub` returns it under `pending_requests`, and the hub renders accept and decline buttons — but nothing told the host the request existed. The roster trigger added in `061` branches on `accepted` and on `left`/`removed` and has no branch for `requested`, so the host got no push, no notification row and no badge, and could only discover the request by opening that specific match's hub and scrolling to it. Meanwhile the requester saw the match in their own list with no indication they were still waiting, and reasonably assumed they were in. The effect was worst on exactly the matches whose hosts care most about who turns up.
- Decision: Add a `requested` branch to `notify_match_roster_change` in `076_notify_join_request.sql`, enqueuing a new `match_join_request` kind to `matches.creator_id` alone via `enqueue_notification`, with a deep link to the match hub where the accept and decline buttons already live. It reuses the same 15-minute dedup bucket as the other roster events, so a player who asks, is declined and asks again in quick succession collapses to one notification instead of pinging the host repeatedly. A guard skips the enqueue when the creator is also the subject, so no one is ever notified about their own action. The kind is registered in all four places a kind has to exist — `NOTIFICATION_KINDS`, the en/ar/fr `notifications.kinds.*` bundles, and the Edge Function's `notification-copy.ts` — so it renders localized rather than falling through to a payload literal.
- Alternatives considered: routing it through `notify_match_participants` like the other roster events (rejected — this is the case the 2026-08-14 entry's "notify only the host" rejection does _not_ cover: a pending request is not a roster change, only the host can accept or decline it, and telling the rest of the roster publishes a decision the host has not made yet); adding the enqueue to the `join_match` RPC instead of the trigger (misses any other path that writes a `requested` row, which is the reason `061` chose triggers in the first place); no dedup bucket (a declined player re-asking three times becomes three pushes); also notifying the requester that their request was received (they already see the state in their own match list, and it doubles the traffic for no decision).
- Consequences: The host is now a single point of failure for a pending request — if they have push off, the request waits until they next open the app, where the notification centre and badge will show it. Requests remain invisible to the rest of the roster by design, so a co-host cannot triage them; there is no co-host concept today. The 15-minute bucket means a genuine second request inside that window is silently dropped rather than queued, which is the intended trade. pgTAP coverage in `076_notify_join_request_test.sql` asserts the host is notified once, the asker is not, nobody else is, repeats collapse, and a creator is never notified about their own row.
- Owner: Founder/technical reviewer

## 2026-08-21 — The host's answer to a join request reaches the player who asked

- Status: accepted
- Context: `076` closed the first half of this flow — the host now learns that someone asked to join. The answer travelled no better than the question had. **Accepted:** the roster trigger fires `match_participant_joined` through `notify_match_participants`, whose third argument is `p_exclude_user_id` and is passed `new.user_id`. Excluding the subject is right for everyone already in the match and exactly wrong for a player promoted out of `requested`, who is the one person waiting on an answer — they were now in a match, with a time and a court, and nothing told them. That is a no-show, and no-show rate is the pilot's counter-metric. **Declined:** `respond_to_join_request` writes `declined`, which matched no branch at all, since `v_was_accepted` is false and the `left`/`removed` branch never fired. Worse than silence: a `declined` row drops out of `list_my_matches`, so the match disappeared from the requester's list with no explanation, leaving them to conclude the app had lost it. Both were verified against the database before being written here.
- Decision: Add `077_notify_join_request_outcome.sql` with two new kinds, `match_request_accepted` and `match_request_declined`, each enqueued to the subject alone. The accepted branch sits inside the existing `accepted` branch and fires only when the previous status was `requested`, so it neither disturbs the roster notification nor fires for an ordinary join. The declined branch keys on `v_was_requested and new.status = 'declined'`. The declined notification deep-links to `/discover` rather than the match, because `get_match_hub` refuses a declined viewer and sending them to the hub would replace a silent dead-end with a visible one; `resolveNotificationHref` gains a `/discover` branch alongside the existing `/matches` one to make that link resolve.
- Alternatives considered: leaving declines silent (rejected — the row leaves `list_my_matches`, so the match vanishes and silence reads as a bug rather than an answer; the 2026-07-26 “Leave match reopens discovery and rejoin” entry already reactivates `declined` rows on rejoin, so the player can act on the news); deep-linking a declined player to the match (rejected — `get_match_hub` returns null for them); dropping `p_exclude_user_id` so the promoted player receives `match_participant_joined` instead (rejected — "Your match gained a player" is not what a newly accepted player needs to read, and the exclusion is correct everywhere else it is used); telling the rest of the roster about a decline (not their business, and the same reasoning as `076`).
- Consequences: Two more kinds to keep in parity across `NOTIFICATION_KINDS`, the three locale bundles and the Edge Function copy table; the existing parity test covers the drift. **A player removed by the host is still not told** — `accepted` → `removed` notifies the roster with `match_participant_left`, which excludes the removed player, so that path has the same shape as the bug fixed here and is not addressed by this change. The 15-minute dedup bucket means an accept, decline and re-accept inside that window collapses to one notification of each kind. pgTAP coverage in `077_notify_join_request_outcome_test.sql` asserts both outcomes reach the subject, that the accepted player does not also receive the roster notification, that the host still does, that a decline reaches nobody else, and that the declined deep link points at discovery.
- Owner: Founder/technical reviewer

## 2026-08-22 — Players choose their own skill band; the questionnaire is retired

- Status: accepted
- Context: The four-question scored questionnaire from the 2026-07-25 entry was never ratified — it is the only entry in this file that stayed `proposed`, and it recorded both that "the exact pilot wording and calibration have not been validated with players" and that the scoring "can be recalibrated before the pilot". Two findings closed it. First, `ProfileSkillBandSection` already lets a player set their band directly from a five-option picker for as long as their rating is provisional (migration `042`), so onboarding was spending four questions deriving a value the rest of the app asks for outright. Second, all four questionnaire answers defaulted to `0` while `0` was also the first option of each question, so every question rendered pre-selected, `Continue` was never disabled, and anyone tapping straight through scored zero and was filed as `beginner` — indistinguishable from someone who genuinely answered that way. Because `docs/DATABASE.md` keeps players provisional until five confirmed results, and a cohort-1 player is expected to reach roughly four matches across the pilot, that mislabel would have stood for the entire pilot and degraded level matching for the players who did answer honestly.
- Decision: Replace the questionnaire with a single five-option list on the same step, one option per database band, nothing pre-selected and `Continue` disabled until a choice is made. Each option is labelled by what a player does — "I am still learning to rally" — with the band name the rest of the app displays as the secondary line. Behavioural labels preserve the questionnaire's one real defence: nobody inflates "still learning to rally" the way they inflate "Advanced". `scoreSkillQuestionnaire`, `skillQuestionnaireSchema` and `SkillQuestionnaire` are deleted rather than left unused, following the `buildExpoPushMessages` precedent in the 2026-08-14 entry. `onboardingInputSchema` only ever required `skillBand` and never the answers, so nothing persisted changes and no migration is needed.
- Alternatives considered: keeping the questionnaire and fixing only the default (still four taps to derive what the profile asks in one, and still a hidden mapping the player cannot argue with); shortening it to two questions (halves the taps, keeps both problems); labelling the options with the band names alone (invites exactly the status inflation the questionnaire existed to resist); leaving the band unset when skipped (needs a discovery rule for unbanded players, a larger change than this step warrants).
- Consequences: The mapping can no longer be recalibrated after the fact from stored answers — the band is now the answer, so re-tuning would mean re-asking players. Judged acceptable, because recalibration needs validation data that will not exist until after cohort A, and by then confirmed match results are a better signal than questionnaire responses. Onboarding step 3 drops from four required taps to one, and the silent-`beginner` default disappears with the defaults that caused it. The retired `onboarding.tennis.questions` and `onboarding.tennis.answerLevels` copy is removed from all three locale bundles. `packages/domain` loses one test along with the function it covered.
- Owner: Founder/product validation

## 2026-08-22 — Optional gender and an avatar that can be set during onboarding

- Status: accepted
- Context: Three requests against the "Tell us about yourself" step. (1) The birth field looked unfinished — a bare four-digit box with no placeholder, hint or feedback — and was read as a date-of-birth field done badly. It is not: `profiles.birth_year` is a `smallint` and adult eligibility is the only thing the product asks of it, so a full date would be more personal data than anything downstream uses. (2) There was no way to add a profile photo during onboarding. The whole avatar pipeline already existed — private bucket, storage RLS, `set_own_avatar`, `pick-own-avatar.ts` — but it was reachable only from the Profile tab, because `set_own_avatar` guarded on `assert_marketplace_caller`, which requires `onboarding_completed_at is not null`. Calling it mid-onboarding failed with "Caller is not marketplace-eligible". (3) There was no gender column anywhere, and gender is absent from the PRD's profile list.
- Decision: Keep collecting the year only, and say so in the field, echoing back the age it implies so the narrower ask reads as deliberate. Regrade `set_own_avatar` from `assert_marketplace_caller` to `assert_authenticated_caller`, which still demands a live session and an account that is neither deleted nor pending deletion; the operation is self-scoped and its authorization does not rest on that guard, since `is_own_avatar_storage_path` pins the path to the caller's own folder, the `042` storage policies independently restrict writes to it, and the update targets `where id = v_user_id`. Marketplace eligibility gates taking part in matches, not describing yourself, and `020_push_tokens.sql` already draws the line in the same place. Add `profiles.gender` as a nullable enum (`woman`, `man`, `other`) written only through `set_own_gender`, with direct column UPDATE revoked as `003` did for `skill_band` and `042` for `avatar_path`. Null is the "prefer not to say" answer rather than a stored sentinel, so an absent gender and a declined one are the same thing to everything downstream. Per explicit product decision, gender is **display only**: nothing filters on it.
- Alternatives considered: collecting a full date of birth (more personal data than the product uses, plus a migration, for no downstream consumer); holding the picked image in memory until `complete_onboarding` succeeds (avoids touching the guard, but carries bytes across four screens and still leaves the Profile-tab path inconsistent); putting the photo on the finish screen instead (safe for the completion gate, but far fewer players would set one); a `prefer_not_to_say` enum member (makes a declined answer indistinguishable in aggregate from one never asked, and adds a value that has to be handled everywhere); gender as a discovery filter (declined — it lets any user enumerate players by gender, which is a targeting risk in a product where strangers arrange to meet).
- Consequences: **Gender is not yet shown to other players.** `get_public_player_card` returns the `discover_compatible_player_card` composite, which `discover_compatible_players` also returns, so surfacing gender on a public profile means adding it to that type and rewriting the discovery function — which would also put the value in every discovery response, where a client could filter on it locally even though the server offers no filter. That is a step toward the filtering this decision declined, so it is left for an explicit call rather than taken by default; today the value is collected and visible only to the player who set it. The avatar regrade widens who may call `set_own_avatar` from onboarded players to any live account, deliberately; `078_profile_gender_and_onboarding_avatar_test.sql` asserts a mid-onboarding caller now reaches the ownership check and is still refused another player's path. While writing this, `set_own_avatar` was briefly rebuilt from `042` rather than from `043`, silently reverting the null-clears-the-avatar behaviour; the existing `042` test caught it, and `078` now carries `043`'s body verbatim with only the guard line changed.
- Owner: Founder/product validation

## 2026-08-22 — Any minute is a valid match start time

- Status: accepted
- Context: `parseStartTime12hInput` rejected any start time whose minutes were not a multiple of 30, and the only error the player saw was "Enter a valid time between 7:00 AM and 9:00 PM". Typing 3:10 PM produced that message even though 15:10 is squarely inside the window, so the rejection was unexplainable from the screen. The rule was a leftover: it belonged to `timeOptions()`, a half-hour slot list that was exported, unit tested, and never rendered by any UI — the control had since become a free text field, which invites exactly the input the parser refused. Nothing enforces alignment server side, and no decision in this file required it.
- Decision: Accept any minute within the 7:00 AM to 9:00 PM window. Delete `timeOptions()` and the deprecated `parseStartTimeInput`, neither of which had a caller other than its own test, following the `buildExpoPushMessages` precedent. The existing error copy needs no change: it now describes the only rule that remains, so it becomes true rather than misleading.
- Alternatives considered: keeping the half-hour rule and naming it in the error message (honest, but it constrains a time the app does not own — the pilot books courts through the club's own WhatsApp, and a club can hand a player 3:10); keeping the rule and replacing the text field with a list of half-hour options, which is what `timeOptions()` was for (a bigger change that re-imposes a constraint with no backing, and the start time here is a proposal to other players rather than a court reservation).
- Consequences: Proposed times are no longer visually uniform, so match cards and time-vote rows will show values like 3:10 PM alongside 6:00 PM. Court availability is unaffected, since the app has never held real availability — `confirm_external_court` records whatever the club actually gave. The test that asserted `("6:15", "PM")` was invalid is inverted rather than deleted, so the change is visible in the suite rather than silent.
- Owner: Founder/product validation

## 2026-08-22 — "We didn't keep score" is a per-player act

- Status: accepted
- Context: `064` made the score optional — attendance completes a match, and a scoreless match is complete, attributed and unrated. What it never gave players was a way to _say_ so. `canSubmitResult` gates on `!hasResult`, which never becomes false if nobody submits, so the score editor rendered indefinitely on precisely the matches that entry predicted would be most common: "two people who hit for an hour and never wrote the games down". The one path most pilot players are expected to take was the only one that never resolved, and expressing it meant walking away rather than doing anything. It also left the data ambiguous — a completed match with no result looked identical whether the players deliberately kept no score or simply never got round to entering one, which are different numbers for a pilot judged on completed matches.
- Decision: Add `match_participants.score_declined_at` and `decline_match_score(p_match_id, p_declined default true)` in `080`, recorded **per participant**, mirroring `match_participants.attendance` rather than the single `match_results` row. Reversible, because a player who declines and then remembers the score should not be stuck. `canSubmitResult` gains `viewerDeclinedScore`, and the panel keeps rendering after a decline so the act leaves a visible trace with a way back, rather than the section vanishing.
- Alternatives considered: one flag per match, so the first player to answer settles it (rejected — a score is a shared fact and the other player may well remember it; whoever opened the app first would close scoring for both and it would need an undo path to climb back out, whereas per-player leaves the other player's ordinary submit-and-confirm flow completely intact); a client-only dismissal (lost on reload, and yields no signal at all for the weekly numbers); adding the flag to `get_match_hub` instead of a dedicated read (that function is 331 lines returning a shared composite, and redefining it wholesale to carry one nullable timestamp is far more blast radius than this warrants — `get_own_score_declined` is read separately, the same way the court-request list already is on this screen).
- Consequences: One more round trip on the result panel, keyed by viewer as well as match. `decline_match_score` refuses once a `match_results` row exists, since at that point the honest actions are confirm or dispute. It mirrors `submit_match_result` on attendance, rejecting `no_show`, `late_cancel` and `cancelled_in_time` while allowing `unknown`. Rating and completion are untouched: this records an intention about the score, never the match outcome. pgTAP coverage in `080_decline_match_score_test.sql` asserts the per-player property directly — one player declining leaves the other reading null and still able to submit a full score.
- Owner: Founder/product validation

## 2026-08-22 — Unread chat is a read marker per participant

- Status: accepted
- Context: `match_messages` carries `created_at` and `author_id`, but nothing recorded who had seen what. The hub's chat row showed the latest message and could not say whether it was new, so a player had to read the preview and remember whether they had seen that line before. Chat is also the only place a match renegotiates a time, so a missed message is a missed match.
- Decision: Add `match_participants.chat_last_read_at` in `081`, with `mark_match_chat_read` and `get_own_chat_last_read`. Stored per participant, alongside `attendance` and `score_declined_at`. Counting stays in the client: `MatchChatEntry` already lists the messages to render its preview, so with a marker in hand the count is a filter over data it already holds rather than a second round trip, and the rule lives in `countUnreadMatchMessages` where it is unit tested. A message counts as unread when it arrived after the marker **and** somebody else wrote it — counting your own would light the badge the moment you sent something. The marker is written when the chat is opened and again when a message arrives while it is on screen, keyed on the newest message so polling does not re-mark.
- Alternatives considered: a per-message read table (a row per message per participant to express "everything before this moment", which is all a reader of a small group thread means); a server-side unread count RPC (a second round trip for something the client can already compute, and it would still need the marker); storing the count rather than the marker (goes stale the instant anyone posts); marking read on message-send only (leaves a thread you opened and read but did not reply to permanently badged).
- Consequences: One extra query per hub render, keyed by viewer as well as match. A locked thread — roster still filling — never badges, since it cannot be opened and the badge would only nag. Messages exactly on the marker count as read, because the marker is `now()` at open and an equal stamp is the message that was on screen. The badge caps at "9+". **Only the hub carries it**: chat has exactly one entry point today, so there is nowhere else it could show, but the higher-value placement is the matches list, which would need the count to travel with `list_my_matches` and is left as a separate decision.
- Owner: Founder/product validation

## 2026-08-22 — Unread chat reaches the Active list; no separate messages inbox

- Status: accepted
- Context: `081` badged the hub's chat row, but the hub is one match at a time, so finding which match had new messages meant opening each one. The count belongs where a player chooses a match, not only after they have chosen. A standalone messages list was considered at the same time and rejected.
- Decision: Add `unread_message_count` to `list_my_matches` in `082`, and render it as a card badge on the Active list. Extending that function rather than fetching separately is what `066`, `067` and `068` each did to add a field, and the count arrives already scoped to the viewer's own participation row, so the read marker needs no extra join. The badge ordering rule lives in `buildMatchCardBadges`: unread comes before the stale-listing badge, because a stale listing is a state of the match while an unread message is somebody waiting on an answer. **No messages inbox**: every thread belongs to exactly one match, so the Active list already _is_ the conversation list, and an inbox would re-list the same rows under a different noun.
- Alternatives considered: a fifth "Messages" tab (rejected — it would surface nothing the badged Active list does not, it competes with WhatsApp where these players already talk and where the product already sends them for club booking, it widens moderation from a fixed match roster toward DMs, and at 50 players and roughly five matches an evening it would be empty most of the time; `docs/PILOT_OPERATIONS.md` also warns that optimising for opens "would justify building the social feed the PRD excludes"); a separate unread-count RPC joined client side (diverges from how every other field reached this list, and adds a second query per screen); counting client side from message lists (the Active list does not fetch messages, unlike the hub's chat row).
- Consequences: `list_my_matches` gains a correlated subquery over `match_messages` per row; the Active list is short by construction, so this is bounded. Deleted messages are excluded, matching every other read of that table. The badge caps at "9+" through the same `formatUnreadBadge` the hub uses. Completed matches never show it, since they are not in this list at all — a thread on a finished match can still receive messages and will badge only in the hub.
- Owner: Founder/product validation

## 2026-08-22 — The bell counts unread from the database, not from a page

- Status: accepted
- Context: The home bell already had a badge, but `HomeDashboard` derived it by filtering the 20-row `listUserNotifications` page for `read_at is null`. That answers "unread among the newest 20", which matches the true figure only until a player leaves something older unread — after that the badge undercounts, and can read zero while the notification centre still lists unread rows. With reminders, join requests, court confirmations and results all landing in the same inbox, twenty fills quickly. `markAllRead` had the mirror-image bug: it looped `mark_notification_read` over the same loaded page, so anything below it stayed unread. The two were consistent only because both meant "the newest 20"; fixing the count alone would have left "mark all read" visibly failing to clear the badge.
- Decision: Add `countUnreadNotifications`, a `head: true` exact count filtered to delivered (`sent_at not null`) and unread, queried on its own key so the badge no longer depends on the list page. Add `mark_all_notifications_read()` in `083`, one statement server side returning how many rows moved, and call it instead of the client loop. Both marking paths invalidate the badge key as well as the list key.
- Alternatives considered: raising the page limit (moves the cliff instead of removing it, and pulls rows nobody renders); keeping the badge derived from the list and paging until exhausted (many round trips to answer a number the database has); marking all read client side with a bulk update rather than an RPC (`notifications` grants `SELECT` only to `authenticated`, deliberately, per the 2026-08-14 grant decision — writes stay behind RPCs).
- Consequences: One extra lightweight query per home render, no rows transferred. `mark_all_notifications_read` deliberately skips outbox rows: a notification with no `sent_at` has reached nobody, and marking it read would hide it before it was ever shown — the same rule the centre's own list applies. The count is not realtime; it refreshes on the existing query invalidations. pgTAP coverage in `083_mark_all_notifications_read_test.sql` asserts the delivered-only rule and that one player's mark-all never touches another's inbox.
- Owner: Founder/product validation

## 2026-08-22 — The free-block screen folds into Discover, and Home gets a player carousel

- Status: accepted
- Context: Tapping a block in Home's "Most players free this week" opened `/free-block`, a screen that called `discover_compatible_players` with the same zone scoping and drew the same player cards as the Discover tab. It was a second discovery surface whose only addition was two parameters — and `discoverPlayerFiltersSchema` already declared `freeFrom`/`freeTo` and `packages/api/src/discovery.ts` already forwarded them as `p_free_from`/`p_free_to`. Discover was built to take the filter and simply never set it. It also read as misleading: finding players is Discover's job, and this was a different page doing it. The screen's other feature, "I am free then too" (`recordAvailabilityPing`), was a supply-side action with no feedback loop — the ping is record-only, nobody is notified, nothing fires — so a player declared availability into the void and hoped someone browsed that block later.
- Decision: Delete `/free-block`. Home's block rows stop navigating and become statements; the players behind the busiest block appear in a carousel directly beneath, and "See all N in Discover" opens Discover with the window applied as a **removable** chip. Removability is the point: a player who lands on two results can drop the chip and browse everyone, which the dead-end page could not offer and which is CLAUDE.md's stated empty-state principle. The card's primary action carries **both halves of the decision** — `prefillCreateMatchDraftForPlayer` already reads `overlap_starts_at`, and `075` computes that overlap inside `greatest(p_free_from, now()) … p_free_to`, so the create flow opens knowing the player _and_ the time. A CTA carrying only "who" would have made the carousel a worse Discover rather than a shortcut past it. `recordAvailabilityPing` and the `availability_ping_sent` event are removed with their last caller.
- Alternatives considered: a standalone Messages-style "free players" tab (rejected in the same discussion — the block list already aggregates the same data, and a fifth tab would surface nothing new); restricting the blocks to today and tomorrow (rejected — liquidity is the scarce resource at 50 players, and CLAUDE.md's empty-state rule points at widening filters, not narrowing defaults); a carousel as the primary discovery surface (rejected — carousels hide items behind a swipe and are poor for comparison, which is why Discover stays the list and this stays a shortcut); keeping the window in state and resetting it from an effect (works, but sets state during an effect for a plainly derivable value, which the React Compiler lint rule rejects; storing _which window was dismissed_ keeps it derived and gets the multi-block case right for free).
- Consequences: The filter is transient — `loadDiscoverFilters` persists only `matchToggles`, and a window chosen for one evening should not survive the session. Discover now reads route params, which it did not before. The carousel adds one query to Home, scoped to the top block and skipped entirely when that block has no players, so Home never shows an empty strip. Visually it reuses the block rows' own shell (`tennisRadii.md`, `borderWidth: 1.5`, `border`, `card`) so the strip reads as part of the section, and the chip reuses `DiscoverMatchChips`' selected-state metrics because an applied filter _is_ selected. `home.free.busiestSubtitle` changed: it promised a tap-through that no longer exists.
- Owner: Founder/product validation

## 2026-08-23 — A player can edit their own name, languages and bio

- Status: accepted
- Context: Saving the About box failed with "permission denied for table profiles", and `/profile/edit` was broken the same way. `updateOwnProfile` writes `profiles` (display_name, languages) and then `player_profiles` (bio); migration `002` granted `authenticated` only `SELECT` on `profiles` plus `update (avatar_path)`, so display_name and languages were never grantable, and `042` later revoked avatar_path when avatars moved behind `set_own_avatar`. That left `profiles` with no UPDATE grant at all, and the first statement took the whole call down with it. This is the shape `062` already fixed once on `notifications`: an RLS policy filters rows, it does not confer table privileges, and `profiles_update_own` has been in place since `001`. The bio was collateral — the About box sent an unchanged display name with every save, so writing a bio depended on permission to rewrite identity.
- Decision: Grant `update (display_name, languages)` on `public.profiles` to `authenticated` in `084`, per column rather than table-wide, keeping the posture `002` set: the Data API gets only what a player edits about themselves, while `avatar_path`, `gender`, `account_status` and `onboarding_completed_at` stay unreachable from a client. Add a `profiles_languages_supported` CHECK, since a grant without one lets a caller reaching past the app store an empty array or an unsupported code that every reader would then have to defend against. Split `updateOwnBio` out of `updateOwnProfile` so the About box writes only the bio — a bio save should not depend on identity permissions whatever the grants say.
- Alternatives considered: a `set_own_profile_identity` RPC matching `set_own_skill_band` and `set_own_gender` (those exist because their columns carry rules a client must not set — a locked skill band, a storage path — whereas `display_name` already has its own CHECK and `languages` now does too, so an RPC would add a hop without adding a guarantee); granting UPDATE table-wide on `profiles` (re-opens every column `003`, `042` and `079` deliberately closed); leaving the About box writing all three fields and only adding the grant (fixes the symptom while leaving a bio save coupled to identity permissions).
- Consequences: `cardinality(languages) >= 1`, not `array_length(...) >= 1` — the latter returns NULL for an empty array and a CHECK only rejects on FALSE, so the obvious spelling would have let `array[]::text[]` through. The test caught that before it shipped. pgTAP coverage in `084_profile_self_edit_grants_test.sql` asserts both halves: the three columns a player may write, and that avatar_path and account_status still refuse them.
- Owner: Founder/technical reviewer

## 2026-08-23 — The profile offers the matches you already have before making another

- Status: accepted
- Context: An audit of the invitation flow, verified against the live database, found two defects. **One:** `player/[id].tsx` called `beginCreateMatchForPlayer` unconditionally, so "Play request" always started a new match. A host with an open singles match and a free slot got one tap to invite from a Discover card, and from the _profile_ got a create that `schedule.tsx` then refused at publish — "You already have an open singles match" — naming the very match listed further down the same screen. The collision was guaranteed, not luck: `preferredFormatForPlayer()` takes no argument and returns `"singles"`. **Two:** `usePublishMatch` ran `createMatchDraft` → `publishMatch` → `createMatchInvite` as three awaits in one mutation, so an invite failure reported a published match as "We could not publish this match", left the draft in place, and made the retry throw `active_hosted_match_exists` — two contradictory errors and an orphaned invite-only match. Reproduced with a blocked target; the likelier pilot trigger is the 20-a-day invite ceiling.
- Decision: "Play request" now opens a `BottomSheet` listing the matches this player can be invited to, each named by format, status and time, with **Create a new match** as the footer action; it creates directly only when there is nothing to offer. The inline "Pick a match" section is removed rather than kept alongside — two controls for one job on one screen is the duplication this audit exists to remove. A Discover card with several inviteable matches passes `pickMatch=1` so it lands on the choice instead of a profile the host must press again, read as a derived value rather than synced through an effect. In `usePublishMatch` the invite is attempted in a `try/catch` and its error returned rather than thrown, so `onError` is reached only by real publish failures and an invite failure lands on the **match hub** with the true reason from the existing `matchInviteErrorKey`.
- Alternatives considered: mirroring the Discover card exactly, inviting straight away on a single match (fastest and perfectly consistent, but it repeats the silent one-tap invite that never names the match — the same criticism raised as finding 3); keeping the create and only moving the "already have an open match" warning earlier (stops the wasted flow but still ignores the invite that was sitting there, telling the host what they cannot do rather than offering what they can); landing an invite failure on that match's invite screen with the player prefilled (puts them where they can retry, but treats a published match as unfinished business); correcting only the message and staying on the schedule screen (leaves them on a screen for a match that already exists).
- Consequences: The profile's primary action now sometimes asks a question, which is one more tap than the Discover card for a host with exactly one match — accepted, because it is the tap that names the match. `matches.invite.inviteToOpenMatch` and four styles went with the inline list. **Finding 3 is deliberately not addressed**: `isInviteableHostedMatch` still ignores `is_creator`, so matches you merely joined count as inviteable and the card's one-match branch can add someone to another host's match without naming it. The server permits that by design — `create_match_invite` allows any participant — so it is a product call, not a defect.
- Owner: Founder/product validation

## 2026-08-24 — Any participant may invite, and the picker says whose match it is

- Status: accepted
- Context: The third finding of the invitation-flow audit. `isInviteableHostedMatch` took a `HostedMatchRef`, was named for hosting, and never checked `is_creator` — so matches a player had merely **joined** counted as inviteable. That is not a server bug: `create_match_invite` authorises any accepted participant, deliberately, because it is what lets someone who joined a doubles match go and find the fourth. The defect was that the name denied it and the UI hid it. A Discover card with exactly one inviteable match sent the invite straight from the card, so a stranger could be added to another host's match without the sender ever seeing whose match it was, or which match had been used.
- Decision: Keep the permission as it is and make it legible instead. Rename to `isInviteableMatch`, with the doc stating plainly that `is_creator` is not required and why. Remove the card's one-match fast path so every invite from Discover goes through the profile sheet, which names the match. Add ownership to each sheet row — "Your match" or "You joined this one" — beside the time, so adding someone to a match that is not yours is a thing you are told you are doing.
- Alternatives considered: adding `match.is_creator` to the predicate so only hosted matches qualify (the obvious reading of the old name, and wrong — it would delete a working capability the server grants on purpose, and strand a doubles player who joined and needs a fourth); keeping the fast path and naming the match on the card instead (card space is already tight with level, area, clubs and availability tags, and the label would have to change shape between "your" and "someone else's" match); leaving it, since nothing errors (the audit's point was that nothing erroring is exactly what makes it worth fixing).
- Consequences: One more tap from a Discover card for a host with a single open match — the tap that names the match. `DiscoverPlayerCardRow` loses its mutation entirely and is now navigation only, so invite handling lives in one place rather than two; `primaryLoading` went with it, since the action no longer waits on anything. Two domain tests added for the cases the old name denied: a joined match counts, a full one does not.
- Owner: Founder/product validation

## 2026-08-24 — Asking a player to play stops being a question about matches

- Status: accepted
- Context: Two days of fixes to the invitation flow had removed the wrong invites but left the question. Tapping **Invite** on a Discover card or **Play request** on a profile forked: with no inviteable match, into a four-step create ending on a button reading **Publish match** under a hint promising Discover visibility — both false, since `prefillCreateMatchDraftForPlayer` sets `invite_only`; with one or more, into a sheet asking which match to use. The sheet was the deeper problem. Not for its tap cost — clicks are cheap when each one is obvious — but because it asked something the screen gave no basis to answer: your open match is Tuesday, the player you are looking at is free Thursday, and nothing on that sheet said whether the two fit. The app holds that data in `near_term_slots` and the weekly pattern; the player does not. Underneath both sat a cap doing a job it was never written for: `create_match_draft` and `publish_match` refused a second active match per format **without checking visibility**, so a private request to one named person consumed a slot created to stop forgotten public listings (2026-07-26, above). The constraint that fixed one invite confusion caused this one.
- Decision: The app answers the question instead of asking it. `inviteMatchForPlayer` picks the one match that fits — host-only, timed, inside a concrete `near_term_slots` block within the three-day window or matching the weekly weekday-and-day-part pattern beyond it, soonest first — and both surfaces name it before acting: a footer row on the Discover card, a line under the profile hero. No fit means the primary reads **Ask to play** and starts a private request. In `085`, the cap counts `visibility = 'public'` only and applies only when creating another public one, so a host with an open listing can still ask anyone. On the schedule screen an invite-for-a-player draft now reads **Send request to {name}** over copy that says only they will see it, and the **Invite players** secondary is hidden there — `destination: "invite"` skips both `publishMatch` and `createMatchInvite`, so on that path the button named after the goal was the one button that never reached it. `findCapBlockingMatch` mirrors the new server rule client-side, left distinct from `findActiveHostedMatch`, which still answers the plainer question of whether a draft is worth resuming.
- Alternatives considered: keeping the sheet and pre-selecting the best match (better-informed, but the fork survives and the player is still asked); making person-first surfaces always create a fresh request and moving "fill my match" wholly to the hub (cleanest mental model — two intents genuinely were sharing one button — but a host wanting a fourth for Thursday doubles would create a second match rather than fill the first); removing the invite button, as first suggested (relocates the decision rather than removing it); replacing the cap with a same-hour overlap guard on accepted matches instead of carving out visibility (it is the harm worth preventing, but it is a different feature and, per below, the gap it addresses already exists).
- Consequences: **Reverses the alternative rejected on 2026-08-24 above** — "naming the match on the card" was dismissed for card density and because the label would change shape between your match and someone else's. Density is still a real cost and the footer now carries a fourth possible row; the shape problem is gone because the auto-pick is host-only, so a joined match never reaches the card and the sheet still names ownership for those. `pickMatch=1` and `playerProfileInviteAction` are deleted — Discover no longer routes to the profile to ask. Verified while planning and worth recording: the cap was never a double-booking guard. `no_overlapping_accepted_court_bookings` (001) keys on `court_id`, and nothing constrains a player's own schedule, so overlapping matches were already possible across formats; `085` does not widen that gap, and a `tstzrange` guard on accepted participation is tracked separately. Also unaddressed: no `cancel_match_invite` exists, so a one-tap invite cannot be withdrawn — not a regression, since the card sent one-tap invites before the sheet existed and now names the match first, but it is the next thing this flow needs.
- Owner: Founder/product validation

## 2026-08-24 — An invite tells the person it was sent to

- Status: accepted
- Context: Found while verifying the change above in the running app. A real invite was sent to a seeded player, the `match_invitations` row was created, and **no notification existed for anyone**. `021` had given `create_match_invite` an `enqueue_notification` call producing a `match_invitation` for the invited user; `044` added the 20-a-day rate limit and rebuilt the function from a pre-`021` ancestor, dropping that call and the `returning id into v_invitation_id` its dedupe key was built from. Nothing raised, nothing failed, and no test covered it, so since `044` every targeted invite has notified nobody — the invited player found out only by opening Matches → Invites unprompted, or by being sent the share link. Exactly the regression shape that `043`'s null-clear hit earlier the same week, except there an existing test caught it within minutes.
- Decision: Restore it in `086`, taking `044`'s body verbatim — diffed against the live definition first — and adding back the declaration, the `returning`, and the notification block. The payload carries only `deepLink`, matching `077` and every recent kind; `021`'s hardcoded English title and body are deliberately not restored, because `notifications.kinds.match_invitation` already exists in all three locale bundles and in `notification-copy.ts`, and a row carrying its own English strings would bypass all of it. pgTAP asserts the targeted case, the deep link, and that an untargeted share link notifies nobody — verified to fail against `044`'s definition, so it covers the regression rather than merely passing.
- Alternatives considered: leaving it to a separate branch (the honest scope call, and rejected because the change above turns a card invite into one tap, so an invite nobody hears about stopped being a latent bug and became the main path); opening the WhatsApp share sheet after a card invite as well, matching the profile (belt and braces for a WhatsApp-first pilot, but it interrupts a scroll on every invite, and the notification is the fix for the actual defect); restoring `021`'s block verbatim including its English strings (would have shipped an unlocalized notification into a flow that is otherwise fully translated).
- Consequences: The comment in `DiscoverPlayerCardRow` justifying the absence of a share sheet — "the invitee already hears about it" — was written against `021`'s source rather than the live function, and was false when written. It is true as of `086`. Invites sent before `086` was applied have no notification and cannot retroactively gain one; the dedupe key is per invitation, so re-inviting the same player creates a fresh invitation and does notify. Worth noting for the pilot: no `cancel_match_invite` exists, so a one-tap invite still cannot be withdrawn.
- Owner: Founder/product validation

## 2026-08-24 — The listing cap says what it actually caps

- Status: accepted
- Context: Reported from the running app immediately after `085`: a host could create several matches through **Invite** and **Ask to play**, then tapping **+** told them "You already have an open Singles match. Invite players or cancel it before creating another." That sentence was true while the cap counted every match. After `085` it is false — another match is exactly what the host had just made twice — and a message contradicting what the user has already done is worse than no message. The escape was worse hidden than the rule was explained: the visibility toggle that resolves it sits on the same screen as the banner, but the banner pointed only at the _other_ match while publish stayed disabled.
- Decision: Keep the rule. In a 50-player pilot the retention risk is not too few listings but stale ones — a player who joins a forgotten match and never gets a game loses trust in a way an empty Discover does not, which is exactly what the July acceptance testing found. Fix the legibility instead. `activeHostedTitle`/`activeHostedBody` now name what is capped ("Only one {{format}} match can be listed on Discover at a time. You can still invite specific players to a new one."), the schedule banner leads with **Make this one invite only** calling `setListOnDiscover(false)` — which clears the banner and re-enables publish in one tap, since the guard is keyed to that toggle — and the footer hint follows the toggle too, so an invite-only draft no longer reads "Publish makes the match visible on Discover".
- Alternatives considered: dropping the cap entirely (simplest mental model, but reinstates the forgotten-listings problem the July decision was made to fix, before the pilot has produced any data to justify reversing it); never blocking at **+** and meeting the rule only at publish (fewest interruptions, but four steps of work before the refusal — the classic reject-at-submit antipattern, and unnecessary once the banner offers a way through); keeping **Cancel** in the create banner alongside the new action (three actions in a banner, one of them destructive and operating on a different match than the screen is about).
- Consequences: **Cancel is removed from both create-flow banners** and now lives only on the match hub, one tap further through "Continue inviting players" — destructive actions belong on the thing they destroy, not on a screen about something else. `confirmCancelHostedMatch` stays, used by `match/[id]/index.tsx`. The **+** alert was never a hard wall — its dismiss action already proceeded to a fresh create — so only its words changed. The details screen keeps an informational banner with a single action, because visibility cannot be changed there.
- Owner: Founder/product validation

## 2026-08-24 — Discover asks people to play; matches are filled from the match

- Status: accepted
- Context: Three passes at the invite flow in two days each fixed a symptom and left the cause. The Discover card and the player profile served two intents through one button — "ask this person to play" and "fill the match I already host" — and every fix was an attempt to guess which one was meant: a sheet that asked, then an auto-picker that answered from availability, then a per-visibility cap so the answer would not dead-end. The founder's read, correctly, was that the flow was still wrong. Meanwhile `/match/[id]/invite` already existed and was better at inviting than the card could ever be: it filters by the match's own format and intent, has search, an overlap toggle and a level window, and tracks who has already been invited so their row renders as invited — state a person-first surface cannot hold.
- Decision: One meaning per surface. Discover and player profiles **always create** — the primary reads "Ask to play" / "Play request" and starts a match with that player prefilled. Inviting into an existing match lives only on that match's own invite screen, one tap from the Matches tab. `inviteMatchForPlayer`, the card's match tag, the profile's picker sheet and their copy are deleted. In `087` the cap becomes a single number: at most **three** active hosted matches, counting drafts, across both formats and both visibilities, replacing both `012`'s per-format rule and `085`'s visibility carve-out. Hitting it prompts a **cancel**, never a delete — `cancel_match` is a soft transition with audit events and participant notifications, and CLAUDE.md forbids destructive deletion of operational records. A dismiss control sits in each hosted card's action strip in the Matches list, because a cap that forces a cancel must make cancelling cheap.
- Alternatives considered: a carousel of your own matches at the top of Discover, selecting one for subsequent invites (the founder's first proposal — it batches nicely for "fill my match", but it introduces a mode, and a mode error sends an invite somewhere the sender did not intend; it also fixes one match for all players, when the verified data showed the right match differs per player — Yara fitting Fri 18:00 and another player Fri 14:37); keeping the auto-picker and only adding the cap (leaves two intents on one button, which is the thing that kept generating defects); dropping the cap entirely (reinstates the forgotten-listings problem `012` was written for, before the pilot has produced data).
- Consequences: **The cost is real and accepted**: asking three people about the same slot is now three matches and the whole cap, when it should be one match with three invites. The mitigation is that "Ask to play" lands on the hub where **Invite players** already sits, so the second person teaches the right path — worth watching in cohort A, because if hosts do not find it the cap will feel arbitrary. `publish_match` keeps a cap guard that can no longer fire in normal use, since the draft it publishes was counted at create time; the pgTAP asserts exactly that, because a naive count there would have blocked every publish. `matches.create.activeHostedTitle`/`activeHostedBody`/`makeInviteOnly` and nine `matches.invite.*` keys are gone with the surfaces that used them; the publish error code changed from `active_hosted_match_exists` to `match_cap_reached`. Still unaddressed: no `cancel_match_invite`, so an invite sent from the match screen cannot be withdrawn.
- Owner: Founder/product validation

## 2026-08-24 — Ask to play meets the cap at the tap, and joiners can invite again

- Status: accepted
- Context: Two gaps in the change above, both raised in review and both confirmed in the code. **One:** the `+` button was guarded by `openCreateMatchFlow`, but "Ask to play" on Discover and "Play request" on a profile called `beginCreateMatchForPlayer` and pushed the route directly — so at three matches the `+` stopped you with an alert while the person-first surfaces walked you into a four-step flow to meet the cap at the end. That divergence between entry points is exactly what made the previous per-format rule feel arbitrary. **Two, and worse:** `create_match_invite` authorises any accepted participant — deliberately, per the record above, because it is what lets somebody who joined a doubles match find the fourth — but `canInvite` on the hub and the invite screen's own guard both required `viewer_is_creator`. While Discover and profiles still invited, joiners had a path; removing those left them with **nowhere at all**, so a doubles match with a joined player could stall with no way to invite anyone.
- Decision: Add `openAskToPlayFlow`, which runs the same cap check as `+` before prefilling and navigating, and route both person-first surfaces through it. Both screens read `my-matches` under the key the tab bar already populates, so the guard costs no extra request. Replace both creator gates with `viewerMayInvite` in the domain package — accepted participant, spare capacity, and a status that still accepts invites — mirroring the server rule in one tested place rather than restating a subset of it in two screens. `matches.invite.playersDescription` loses "your match", which is untrue for the joiner this screen now serves.
- Alternatives considered: putting the cap check on `create/index.tsx` so every entry is covered at the door (one place rather than two, but it stops you _after_ navigating, which is a banner rather than a refusal, and the `+` would still behave differently); leaving the invite screen creator-only and restoring a person-first invite path for joiners (re-opens the two-intents-one-button problem this whole change exists to close); keeping the capacity and status checks inline at each call site (they are part of the same server rule, and splitting them is how the creator-only version drifted from `create_match_invite` unnoticed).
- Consequences: `canInvite` on the hub is now one call rather than three inlined conditions, and its `status === "full"` clause is preserved though it remains unreachable while the capacity check stands — parity with the previous behaviour rather than a silent change. Verified in the running app: a host at three matches gets the cap alert from Discover, and a player who joined another host's doubles sees **Invite players** and reaches the screen. Still no `cancel_match_invite`, so an invite sent from that screen cannot be withdrawn.
- Owner: Founder/product validation

## 2026-08-25 — The invite screen filters for the match, not for the host

- Status: accepted
- Context: `/match/[id]/invite` is the only place to fill a match now that Discover and profiles always create. It already ordered candidates sensibly — `availability_overlap desc, level_distance asc, completed_match_count desc` — but every term is measured against the **viewer**, and `discoveryFiltersForMatchInvite` passed only `format` and `intent`. So a player free only Tuesday evenings ranked top for a Friday 6pm match as long as they overlapped the _host_ on Tuesday. Worse for area: with `p_zone_ids` null the RPC falls back to the viewer's own `player_zones`, so a match hosted in Pilot North by someone who prefers Beirut was scoped to Beirut. The same wrong-subject defect removed from the Discover card the day before, surviving in the one screen that knows the match's actual details.
- Decision: Pass the match's own window and zones. `matchTimeWindow` (new, tested) reads `agreed_starts_at` against its `proposed_times` row for the real duration, spans every proposed option while a flexible match is still voting, and returns nothing when the match has no times — a draft should list everyone rather than nobody. `requireAvailabilityOverlap` becomes false because it is the viewer-subject gate being replaced, not supplemented; the two are independent branches in the SQL, and leaving both on would demand a player be free at the match's hour _and_ share some unrelated slot with the host. Zones come from `hub.zones` via the existing `zoneIdsFromPlayerZones`, already used this way by `rematch-draft`. An empty zone list is dropped rather than passed, since the RPC reads it the same as null. The widen controls move out of the empty state to sit permanently under a line naming the active filter, and the empty state names the hour that emptied it instead of sending the host to Discover to widen filters that were never there.
- Alternatives considered: ranking by match-time fit instead of gating on it (never empties the list, but the RPC has no ranking term for the free window — only a gate — so it needs a migration); gating only for fixed-time matches (most cautious, but the screen would behave two ways and a flexible match's proposed span is a perfectly good window); repeating the fit on each card rather than one line above the list (twenty repetitions of a fact that is true of every row by construction).
- Consequences: **A claim in the plan for this change was wrong and is corrected here.** It said a host who widened their match's skill range "sees none of the players they widened it for", and the work included a `levelWindowForMatchRange` helper plus a _Show wider levels_ button. `p_level_window` never reaches a WHERE clause — it only sets the returned `level_fit` flag, which this screen does not read — so level never filtered, those players were always listed, and the button would have returned an identical list. Verified against the live database: window 1 and window 3 return the same six candidates. The helper, its tests and the button were deleted rather than shipped. Level therefore moves to the follow-up with club overlap, where both need `discover_compatible_players` to gain real parameters. Verified working: a Wed 18:00 match lists Yara (free 17–22) and excludes Jihad (free 12–17 that day) and Player J (Tuesday only); one tap on _Show players outside this time_ brings them back; a Pilot South match returns Pilot South players rather than the host's nine; a 03:00 match returns zero, so the reasoned empty state renders.
- Owner: Founder/product validation
