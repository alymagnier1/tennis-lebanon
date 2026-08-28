# Pre-pilot audit recommendations

**Date:** 2026-08-26  
**Context:** User asked which audits to run using available skills before the 50-player pilot.

Two related answers were given in the chat — first a force-ranked skill list, then a sequencing correction after reading `PILOT_50_PLAYER_LAUNCH.md`. Both are preserved here.

---

## Part 1 — Force-ranked skill audits

Two product audits were already done (Jobs 3/10, Cialdini 7/10). **Highest-value action that is not a skill:** walk the app on a real phone since the Home carousel changes. No source audit substitutes for that.

### Before you let a single real player in

**1. Security review** — `security-review` subagent + `supabase` skill for RLS specifics.  
Only category where a mistake is unrecoverable. Birth years, home zones, chat in a small community. Large uncommitted diff included migration `088_invite_and_join_notes.sql` (user-authored text into notifications). A leaked phone number in Beirut ends the pilot.

**2. Cold-start problem** — `cold-start-problem`.  
Atomic network is not "300 players in Lebanon" — it is one level band, one zone, overlapping times, one club that answers WhatsApp. Cialdini social-proof gaps are downstream of liquidity you don't have yet. See [`COLD_START_RECRUITING_2026-08-27.md`](COLD_START_RECRUITING_2026-08-27.md).

**3. Lean analytics** — `lean-analytics`.  
Pick the One Metric That Matters before launch. Events exist (`trackDiscoverViewed`, empty-room canary, rematch tracking) but no stated success threshold. Likely OMTM: **percentage of created matches that reach confirmed played**, with Discover empty-room rate as leading indicator.  
_(Later narrowed — see [`COHORT_1_DOC_THRESHOLD_AUDIT_2026-08-27.md`](COHORT_1_DOC_THRESHOLD_AUDIT_2026-08-27.md). PRD §7 + ops SQL already cover most of this.)_

### Before you scale past the first cohort

- **Release-it** — Lebanon power cuts, patchy mobile data, core flow leaves app for WhatsApp. Timeouts, retry, offline mid-publish.
- **UX heuristics** — deliberate accessibility/usability pass; Jobs review found carousel a11y hole by accident.
- **Mom Test** — interview script for first twenty players; avoid "do you like the app?"
- **Bugbot** — on diff right before pilot build (build-time gate, not a phase).

### Save for after pilot data

`improve-retention`, `hooked-ux`, `continuous-discovery` diagnose behaviour not yet observed. `contagious` matters once WhatsApp sharing reliably works.

### Deliberately not run

Positioning already sharp on Welcome. Revenue/scale/team skills (`monetizing-innovation`, `predictable-revenue`, `crossing-the-chasm`, `blue-ocean-strategy`, `traction-eos`, `team-topologies`, `high-output-management`) assume a company that doesn't exist yet.

---

## Part 2 — Phase 0 _is_ the audit

**Short answer:** Don't insert an audit phase before the plan. Phase 0 _is_ the audit, and the launch plan already absorbs most proposed work.

- `pnpm db:test` = authorization matrix (security review)
- Phase 2 = cold-start supply math (four venues, ~18 prime-time slots vs ~5 matches/evening)
- Line 228 = physical-device walkthrough mandate

The question is **which few audits change an input to the plan** rather than grading its output.

### The one that must happen before execution

**Cold-start — Phase 7.1 recruiting** changes _who_ you recruit (hard to undo).

Phase 2 does supply math but not demand-density math. Line 7.1 says recruit a "mix of skill levels" — risky at this density. Fifty players across five bands ≈ ten per band before zone/time filters → two or three candidates per evening. Cohort A (20 players) is worse: four per band; 7.4 asks for three public matches and two joins.

**Concentrate:** recruit adjacent bands, not five. One dense pocket, not five sparse ones. See [`COLD_START_RECRUITING_2026-08-27.md`](COLD_START_RECRUITING_2026-08-27.md).

_(This recommendation originally said **two** adjacent bands. **Three** centred bands were chosen — `DECISIONS.md`, 2026-08-27 — accepting that Improving and Advanced cannot see each other under the ±1 discovery window. See "Why three and not two" in the cold-start audit.)_

### Three to fold in as you go

| Audit          | When             | Action                                                                                                                                                        |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lean analytics | Before Phase 7   | Cohort B had no numeric thresholds in "What to measure" except crash-free ≥99.5%. Pick one deciding metric with a number. → Addressed in doc threshold audit. |
| Mom Test       | Before Phase 7.8 | Half-page interview questions for non-completers — not just bug funnel. → Three questions added to launch doc.                                                |
| Release-it     | Phases 4–6       | Throttled-mobile create → hub → WhatsApp → confirm rehearsal. → Connectivity gate added to Phase 7.                                                           |

**Targeted security pass** on uncommitted diff before Phase 4: migration `088` (free-text join notes → notification path). Narrow review, not a sweep — `088_invite_and_join_notes_test.sql` already exists.

### Walk back

14-tap onboarding Jobs fix — **wait for Gate 7.3** (≥80% onboarding completion). Let cohort A answer whether taps are a real problem.

---

## Related artifacts

- [`COHORT_1_DOC_THRESHOLD_AUDIT_2026-08-27.md`](COHORT_1_DOC_THRESHOLD_AUDIT_2026-08-27.md) — four doc edits applied
- [`PHASE_0_MANUAL_REHEARSAL_GUIDE.md`](../PHASE_0_MANUAL_REHEARSAL_GUIDE.md) — Phase 0.3 / 0.4 script
- [`PILOT_50_PLAYER_LAUNCH.md`](../PILOT_50_PLAYER_LAUNCH.md) — launch runbook
