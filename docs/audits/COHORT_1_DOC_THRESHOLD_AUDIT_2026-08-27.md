# Cohort-1 doc threshold audit

**Skill:** `lean-analytics` (narrowed after reading existing instrumentation)  
**Date:** 2026-08-27  
**Outcome:** Four doc edits applied across eight files; cohort-1 threshold block added to launch plan.

---

## Finding

PRD §7 pilot success thresholds were written for the **full 300-player pilot**, not cohort 1 (50 players). Two thresholds were **unreachable by design** after the 2026-08-19 decision (no partner clubs in cohort 1; club response time unmeasurable):

- 5–8 operational partner clubs
- Median club response under 30 minutes

`CLAUDE.md` precedence ranks `docs/PRD.md` above the launch checklist, so stale §7 thresholds outranked accepted decisions until corrected.

A doc sweep found the same stale framing in six files plus an internal contradiction in `PILOT_OPERATIONS.md` (line 40: no partner clubs vs line 518: founder sign-off with partner club staff).

**Lean-analytics audit largely redundant:** `PILOT_OPERATIONS.md` already has working SQL for fill rate, expiry, repeat play, host-vs-joiner retention, and liquidity signal.

---

## Four edits (applied)

### Edit 1 — Cohort-1 threshold block

Add a cohort-1 bar beneath PRD §7 in `PILOT_50_PLAYER_LAUNCH.md`:

- Keep behavioural ratios: fill rate, confirmed-to-played, repeat play
- Drop the two club metrics with explicit "why unmeasurable"
- Scale player count to 50
- Clarify 40% = pass, 50% = healthy (PRD vs ops SQL comment clash)
- Leave liquidity-signal threshold **deliberately unset** rather than guessed

### Edit 2 — Phase 7.1 skill mix

Replace "mix of skill levels" with weight toward **improving / intermediate / advanced**, intermediate as largest group. Respects ±1 discovery window.

### Edit 3 — Connectivity gate (Phase 7)

PRD requires screens usable on intermittent connections and P95 under 2s on Lebanese mobile. Add rehearsal row: create → hub → WhatsApp → confirm on throttled data with screen locked mid-flow.

### Edit 4 — Three Mom Test questions (Phase 7.8)

For signups who never created or joined:

1. What did you do instead that week?
2. What were you expecting to see when you opened it?
3. What would have made you open it again?

---

## What was dropped from the broader audit proposal

| Proposed audit       | Why dropped                                           |
| -------------------- | ----------------------------------------------------- |
| Full security review | Phase 0.2 `pnpm db:test` + `088` test cover it        |
| Cold-start audit     | Phase 2 supply math + discovery defaults already done |
| Lean analytics sweep | PRD §7 + ops queries already instrumented             |

---

## Files touched (doc propagation)

`PRD.md`, `PILOT_50_PLAYER_LAUNCH.md`, `PILOT_OPERATIONS.md`, `APP_SUMMARY.md`, `README.md`, `RETENTION_UX_AUDIT.md`, `STAGING_CHECKLIST.md`, launch doc header.

**Inclusion rule used:** fix anything asserting a pilot target, threshold, or launch promise about partner clubs or club response time; leave schema docs, historical records, and correctly-scoped future milestones.

---

## Related

- [`PREPILOT_AUDIT_RECOMMENDATIONS.md`](PREPILOT_AUDIT_RECOMMENDATIONS.md)
- [`PILOT_50_PLAYER_LAUNCH.md`](../PILOT_50_PLAYER_LAUNCH.md)
- [`DECISIONS.md`](../DECISIONS.md) — 2026-08-19 no-partner-clubs entry
