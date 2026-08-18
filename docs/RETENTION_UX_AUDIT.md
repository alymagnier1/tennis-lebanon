# Retention & UX audit — Tennis Lebanon

**Status:** Proposed (hypotheses only — not validated by analytics)  
**Date:** 2026-08-17  
**Branch context:** Retention-engagement  
**Sources:** Mobile app code, `docs/FLOWS_AND_SCREENS.md`, `docs/DECISIONS.md` (2026-08-15/16), `docs/PRD.md`

**Scope:** Optimize for users successfully arranging and playing **recurring tennis matches**, not simply opening the app more often. No implementation until approved.

**Frameworks applied:** Hook Model, B=MAP / Tiny Habits, UX heuristics (Krug / Nielsen)

**Constraints:** No artificial daily streaks, meaningless badges, spam notifications, or dark patterns. Tennis is normally a weekly activity — prioritize completed matches and repeat play over daily app usage.

---

## Overview

### Core diagnosis (hypothesis)

The product already encodes a strong episodic job — find, book, play, confirm — but the habit loop breaks **after the first completed match**. Rematch exists on the completed hub only; Home stays silent when there is no next action; and there is no product analytics to prove which step kills repeat play. The competitor is WhatsApp, not another tennis app.

### Diagnostic scores (hypotheses until instrumented)

| Lens              | Score    | Notes                                                         |
| ----------------- | -------- | ------------------------------------------------------------- |
| Hook loop         | ~5 / 10  | Rematch + job-named push exist; loop incomplete after match 1 |
| B=MAP retention   | ~5 / 10  | Create/book friction; silent Home troughs at low motivation   |
| UX heuristics     | ~6 / 10  | Strong `next_action`; hub length; buried rematch              |
| Product analytics | 0 events | Cannot validate any retention hypothesis yet                  |

### Success definition for this audit

**Optimize for:**

- Completed matches per week (north star)
- Time to 2nd completed match after 1st
- Rematch / repeat-partner rate
- Confirm → rating path when player wants it

**Explicitly not optimize for:**

- Daily active users or open streaks
- Artificial badges / points games
- Spammy re-engagement pushes
- Social feed or infinite scroll (PRD excluded)

### Already shipping (do not reinvent)

| Lever                       | Where               | Why it helps retention                                    |
| --------------------------- | ------------------- | --------------------------------------------------------- |
| Rematch CTA                 | Completed match hub | Captures the only high-motivation moment after play       |
| Job-named notification copy | Push / inbox        | Pulls on another human waiting — ethical, event-tied      |
| Provisional rating progress | Home                | Turns honesty constraint into a quest (rated matches → 5) |
| Home next-actions           | Home                | Surfaces invite / vote / book / “did you play?”           |
| Attendance completes match  | Result panel        | North star counts casual play, not score diligence        |

---

## 1. Activation moment

### Proposed activation definition

A user is **activated** when they complete their first match where they confirmed they played (attendance path or confirmed score). Signup, profile, or first join alone are leading indicators — not activation.

| Concept            | Definition                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aha moment**     | “I found someone at my level, we locked a time/court, and we actually played.” Emotional: relief + belonging. Rational: faster than WhatsApp coordination. |
| **Starter step**   | After onboarding: set one weekly availability window OR join one open match in preferred zones — not “fill every preference.”                              |
| **Retention gate** | Power users: complete match → rematch within 14 days → 2nd complete. Measure that path before adding surfaces.                                             |

### Activation funnel (hypothesized drop-offs)

| Step                    | Motivation                  | Ability risk                | Prompt today                |
| ----------------------- | --------------------------- | --------------------------- | --------------------------- |
| Finish onboarding       | Hope of finding games       | Many fields (mental effort) | In-flow only                |
| Discover / create       | Want a hit this week        | Filters + multi-step create | Home empty → weak           |
| Fill + agree time       | Social commitment           | Voting / waiting            | Push: joined / vote         |
| Secure court            | Fear of no venue            | Club response latency       | Booking pending / confirmed |
| Play + confirm attended | Closure / fairness          | Must open app after play    | Attendance / played prompts |
| Rematch / next match    | Belonging with good partner | Rematch buried; host-guard  | None outside hub            |

**Hypothesis:** The fatal cliff is step 6 (first → second match), not step 1. Design energy should protect post-match rematch and Home “what’s next” when the inbox is empty.

---

## 2. Retention loop

**Target loop (weekly, not daily):**

```
discover suitable match/player → join or create → secure court → play
→ confirm score (optional) → rating update (if confirmed) → rematch or find next
```

### Loop map — current vs desired

| Stage            | Internal trigger         | Action today                | Reward today                   | Investment / next trigger | Gap                                  |
| ---------------- | ------------------------ | --------------------------- | ------------------------------ | ------------------------- | ------------------------------------ |
| Discover         | Free time / want a hit   | Discover Players\|Matches   | Compatible people / open games | Filters, zones, prefs     | Home silent when empty               |
| Join / create    | Commitment itch          | Join or multi-step create   | Roster forming                 | Draft prefs, invite link  | Create friction vs docs “one screen” |
| Secure court     | Fear match falls through | Book / wait club            | Confirmed court                | Preferred clubs           | Latency; alternative path UX         |
| Play             | Anticipation             | Show up (offline)           | The hit itself                 | Chat, reminders           | App idle until after                 |
| Confirm + rating | Fairness / mastery       | Attendance → optional score | Progress bar / rated count     | Match history             | No rating history screen             |
| Rematch / next   | Belonging                | Rematch card on hub only    | Known good partner             | Prefill draft             | Not on Home / Completed / push       |

### Hook Model scorecard (hypothesis)

| Diagnostic                    | Status                 |
| ----------------------------- | ---------------------- |
| Internal trigger mapped       | Partial                |
| Action dead-simple            | Partial                |
| Variable ethical reward       | Tribe + mastery        |
| Investment loads next trigger | **Weak after match 1** |

**Ethics:** Facilitator path if rematch + event pushes only. Cap engagement that invents loss (streaks).

### B=MAP scorecard (hypothesis)

| Diagnostic                 | Status                  |
| -------------------------- | ----------------------- |
| Works at low motivation    | Home trough fails       |
| Event-tied prompts         | Strong                  |
| Celebration after key acts | Toasts; rematch late    |
| Weakest Ability link       | Mental effort / waiting |

**Tiny habit recipe:** After Sunday planning → set availability → see “open near you.” Celebration = one clear game option.

### Ethical engagement opportunities

**Do:**

- Rematch with named opponent
- “X open matches in your zones this weekend” (only when true)
- Progress to established rating
- Club confirmed; opponent waiting on your vote/score

**Never:**

- Fake urgency
- Public shame
- Guilt-open pushes (“We miss you!”)
- Daily streaks

---

## 3. Flow-by-flow UX audit

All findings are hypotheses pending analytics + pilot interviews. Severity uses Nielsen-style scale for this product context.

| Flow / screen       | Job & motivation                  | Friction / CTA                                             | Trust · states · a11y                          | Sev          |
| ------------------- | --------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- | ------------ |
| Onboarding          | Become playable; hope             | Long form; starter step unclear                            | Consent strong; notify primer OK               | Major        |
| **Home**            | What do I do now?                 | Next-actions good; silent empty; no rematch/score kinds    | Skeleton/error OK; no liquidity empty          | **Critical** |
| Discover            | Find someone / a game             | Players default good; filter load; invite vs create        | Empty + relax filters strong                   | Minor        |
| Create match        | Host a game                       | Multi-step vs doc single screen; host-guard blocks rematch | Prefill strong; review redirect                | Major        |
| Invite / share      | Fill roster without leaking phone | Share sheet OK; pick-among-opens friction                  | Privacy correct                                | Minor        |
| Match hub           | Advance this match                | `next_action` strong; long scroll; joiner wait             | Semantic status + banners good                 | Major        |
| Time voting         | Agree when                        | Flexible adds steps vs fixed                               | Uncertainty if vote stalls                     | Major        |
| Book court          | Lock venue                        | Club latency; alt/reject paths                             | Pay-at-club clarity needed                     | Major        |
| Matches tab         | Inbox + history                   | 3 segments + filters; rematch not on completed row         | Empty/error per segment good                   | Major        |
| Result / attendance | Close the loop fairly             | Doubles partner + multi-set mental load                    | Did-not-play confirm ethical                   | Minor        |
| Rating progress     | Mastery / honesty                 | Bar on Home only; no history/explain screen                | Uses rated count (correct)                     | Major        |
| **Rematch**         | Play again with them              | Hub-bottom only; host-guard; no push                       | Attendance gate honest                         | **Critical** |
| Notifications       | Act when my turn                  | Copy job-named (good); no rematch kind                     | Deep links present                             | Minor        |
| Player profile      | Trust before challenge            | Challenge sticky good; no recent rematch cue               | No public shame (good); fetch error weak retry | Minor        |

### Per-dimension checklist (all flows)

**Visual hierarchy & primary CTA**

- Hub and Home follow “one next action.”
- Discover cards sometimes compete (row tap vs Invite).
- Rematch is demoted below paperwork — correct during disputes, wrong once completed if the only forward CTA is scrolled off-screen.

**Trust, safety, uncertainty**

- No phone reveal, block/report paths, provisional labeling — aligned with PRD.
- Gaps: club response ETA, what happens if booking rejected, score “unverified” education.

**Empty / loading / error / cancel**

- Lists generally covered.
- Gaps: Home with zero next-actions; offline rarely first-class; cancel/leave policy impact must stay explicit (already separate routes).

**Accessibility**

- Tokens + SemanticBadge pair color with glyph (good).
- Watch: touch targets on secondary hub links, RTL layout on long hub, screen reader labels on segment controls and progress bar.

**Notification timing**

- Event-tied kinds exist (invite, join/leave, court, attendance, result confirm).
- Missing ethical prompts: rematch available after complete; “open matches near you” only when inventory exists — never calendar spam.

---

## 4. Prioritized UI/UX improvements

Ordered by expected impact on completed matches and repeat play, not on DAU. **Do not implement until approved.**

| P      | Change                                                        | Why                                    | Effort | Risk                    |
| ------ | ------------------------------------------------------------- | -------------------------------------- | ------ | ----------------------- |
| **P0** | Instrument funnel analytics (section 7)                       | Cannot prioritize blind                | S      | Low                     |
| **P0** | Surface rematch on Home + Completed list when eligible        | Closes first→second match cliff        | M      | Low                     |
| **P0** | Home empty-state: “Can I play soon?” liquidity CTAs           | Fixes low-motivation trough            | S      | Low                     |
| P1     | After attendance success: elevate Rematch before scroll-death | Same motivation wave as play           | S      | Low                     |
| P1     | Optional event push: rematch available (named opponent)       | External trigger until internal habit  | S      | Med — keep opt-in prefs |
| P1     | Clarify one-active-host rule when rematch blocked             | Ability failure feels like product bug | S      | Low                     |
| P2     | Simplify create: schedule-first publish; details secondary    | Align code with “one decision: when”   | M      | Med                     |
| P2     | Hub sticky primary CTA / collapse completed paperwork         | Don’t Make Me Think on long hubs       | M      | Low                     |
| P2     | Rating explanation + private history screen                   | Mastery reward without public shame    | M      | Low                     |
| P3     | Weekly availability tiny habit from Home                      | Loads discover inventory for next week | S      | Low                     |
| P3     | Booking uncertainty copy (ETA, alt, pay-at-club)              | Reduces abandonment while waiting      | S      | Low                     |
| —      | **Do not:** streaks, badges, feed, daily open nudges          | Violates PRD + ethics + weekly nature  | —      | High if ignored         |

**Out of scope unless explicitly expanded:** Standing groups, tournaments, ladders, social feed, public reliability scores, and in-app payments. Rematch prefill is the lean substitute for recurring groups.

---

## 5. Wireframe recommendations

Low-fidelity structural recommendations — not visual design. Approve before polish or code.

### Home — empty trough

```
[Greeting]
[PRIMARY] See who's free near you
[secondary] Browse open matches
[secondary] Set this week's availability
[muted] Optional: rating progress
```

When next-actions exist, keep them above; never show a blank Home.

### Home — rematch eligible

```
[Next actions (max 3)]
[PRIMARY] Play again with Sara
[secondary] Confirm score · Match name
[Upcoming]
```

New next-action kind: `rematch`. Same route as `beginRematch` → schedule.

### Completed hub — post-result

```
Status: Completed
[PRIMARY] Play Sara again
[secondary] Add / confirm score
▸ Match details (collapsed): roster, court, chat history
```

Invert current order once completed: forward CTA first, archive second.

### Matches · Completed row

```
vs Sara · Sun                    [Rematch]
```

Row tap → hub; Rematch → create draft without forcing hub scroll.

### Create · rematch land

```
Playing Sara again · Singles · Zones set
[PRIMARY] Pick time → Publish
[secondary] Adjust details
```

One decision visible: when. If host-guard blocks, explain and offer open existing match instead.

### Copy principles

| Avoid              | Prefer                                        |
| ------------------ | --------------------------------------------- |
| We miss you!       | 2 open matches in Achrafieh this week         |
| Confirm attendance | Say whether you played so it can count        |
| Create match       | Play Sara again / Organise a match            |
| View details       | Request court / Vote on time / Invite players |

---

## 6. Hypotheses and success metrics

**Format:** We believe [outcome] if [persona] achieves [action] with [change]. Pre-commit success criteria before building.

| ID  | Hypothesis                                                      | Primary metric                        | Guardrail                  | Target (pilot)              |
| --- | --------------------------------------------------------------- | ------------------------------------- | -------------------------- | --------------------------- |
| H1  | Rematch on Home/Completed raises 2nd completed match within 14d | % activated users with match #2 ≤14d  | Cancel/no-show rate        | +25% relative vs baseline   |
| H2  | Home liquidity empty reduces bounce to WhatsApp after open      | Home → Discover/Create within session | Notification opt-out       | ≥40% of empty-Home sessions |
| H3  | Post-result rematch elevation beats buried card                 | Rematch start rate after complete     | Accidental rematch cancels | ≥30% of eligible completes  |
| H4  | Job-named attendance push increases confirm-played              | Attendance response ≤24h              | Push disable rate          | ≥60% prompted users         |
| H5  | Rating progress increases score-confirm among singles           | Confirmed scores / completed singles  | Dispute rate               | Lift without dispute +      |
| H6  | Create simplification increases publish success                 | Schedule start → publish              | Invalid public (no club)   | ≥70% drafts published       |

### North-star & pilot guardrails (from PRD)

- **North star:** Completed matches per week
- **Retention guardrail:** 30-day repeat play after first completed match
- **Liquidity / trust:** Fill rate, time-to-full, no-show rate, club response time

**Reject vanity metrics:** DAU, session length, notification volume, badge unlock counts.

---

## 7. Analytics event-tracking plan

### Current gap

Mobile has no product analytics layer (Sentry only). Until events ship, every retention claim remains unvalidated.

**Privacy:** No message bodies, phones, emails, precise location, or tokens in event props.

### Funnel events (ordered)

| Event name               | When                 | Key properties                                     | Validates             |
| ------------------------ | -------------------- | -------------------------------------------------- | --------------------- |
| `onboarding_completed`   | Profile usable       | `zones_count`, `format_pref`                       | Top of funnel         |
| `discover_viewed`        | Discover focus       | `segment`, `filter_hash`                           | H2                    |
| `discover_result_tapped` | Player/match open    | `result_type`                                      | Liquidity quality     |
| `match_create_started`   | Enter create         | `source`: home\|discover\|rematch\|challenge\|tab  | H3/H6                 |
| `match_published`        | Publish success      | `visibility`, `format`, `club_count`, `is_rematch` | H6                    |
| `match_joined`           | Join / accept invite | `match_id`, `path`                                 | Fill rate             |
| `time_vote_cast`         | Vote saved           | `match_id`                                         | Coordination friction |
| `booking_requested`      | Request sent         | `club_id`, `match_id`                              | Court path            |
| `booking_resolved`       | Accept/reject/alt    | `outcome`                                          | Club latency          |
| `attendance_recorded`    | Played / did not     | `status`, `source`: home\|hub\|push                | H4                    |
| `result_submitted`       | Score entered        | `format`                                           | H5                    |
| `result_confirmed`       | Mutual / auto        | `method`                                           | Rating path           |
| `match_completed`        | Status → completed   | `completion_reason`                                | North star            |
| `rematch_offered`        | UI shows CTA         | `surface`: hub\|home\|completed_list               | H1/H3                 |
| `rematch_started`        | `beginRematch`       | `opponent_count`, `surface`                        | H1/H3                 |
| `rematch_published`      | Rematch publish      | `hours_since_prior_complete`                       | Repeat play           |
| `home_empty_cta_tapped`  | Liquidity CTA        | `cta`: discover\|create\|availability              | H2                    |
| `notification_opened`    | Push/inbox open      | `kind`, `deep_link_type`                           | Prompt quality        |

### Derived metrics (compute in warehouse / dashboard)

**Activation**

- `onboarding_completed` → first `match_completed` (median hours)
- % completing ≤7d / ≤14d

**Repeat play**

- Among users with ≥1 complete: % with ≥2 in 30d
- Median days between complete #1 and #2
- `rematch_published` / `rematch_offered`

**Coordination health**

- publish → full; full → booking_requested; booking → confirmed; confirmed → attendance
- Drop-off at each edge

**Prompt health**

- `notification_opened` by kind
- Attendance within 24h of prompt
- Push disable / notification pref changes (opt-out guardrail)

### Suggested rollout

1. Add typed client `track(event, props)` with allowlisted props.
2. Emit P0 funnel events only (create → complete → rematch).
3. Build a simple cohort view: week N activation & repeat.
4. Only then ship Home rematch / empty-state experiments.

---

## Related code & docs

| Area                | Path                                                          |
| ------------------- | ------------------------------------------------------------- |
| Home next-actions   | `apps/mobile/src/lib/home-next-actions.ts`                    |
| Rematch draft       | `apps/mobile/src/lib/rematch-draft.ts`                        |
| Rematch card        | `apps/mobile/src/components/match/MatchRematchCard.tsx`       |
| Result / attendance | `apps/mobile/src/components/MatchResultPanel.tsx`             |
| Retention decision  | `docs/DECISIONS.md` — 2026-08-16                              |
| Screen inventory    | `docs/FLOWS_AND_SCREENS.md`                                   |
| Interactive canvas  | `.cursor/projects/.../canvases/retention-ux-audit.canvas.tsx` |

---

## Approval gate

No implementation until the human approves the proposed design. Suggested first slice options:

1. **Analytics only** — instrument P0 funnel events
2. **Home rematch + empty state** — UI changes without new backend
3. **Full P0 pack** — analytics + Home + Completed rematch surfaces
