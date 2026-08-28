# Phase 0 manual rehearsal guide (0.3 / 0.4)

**Date:** 2026-08-27  
**Source:** Chat walkthrough of `PILOT_OPERATIONS.md` § "Four workflow rehearsals"  
**Phase 0.3:** Run the four workflow rehearsals on a fresh local reset.  
**Phase 0.4:** Fix every P0 surfaced — record hesitations, not just hard failures.

---

## Setup

Three commands, then two player sessions running at once:

```bash
pnpm db:reset        # migrations + seed, fictional data only
pnpm dev:mobile
pnpm dev:dashboard
```

- Every seeded account uses password `password`.
- Need `player-a` and `player-b` signed in simultaneously — device + simulator, or two simulators.
- Magic-link mail lands in Mailpit at `127.0.0.1:54324`.
- Pull latest magic link: `node scripts/rating-sandbox.mjs magic-link <email>`

---

## Workflow 1 — Join a public match

Seed already has Player A hosting an open singles match in Pilot Central. Join as `player-b` rather than building liquidity by hand.

**Verify:** join or approval lands, time vote reaches unanimous, hub shows a next action.

**Watch for:** not whether it works — whether the hub tells you what to do next without working it out.

---

## Workflow 2 — Create and secure a court

Most important workflow — actual cohort-1 booking model.

Host as `player-a`, join as `player-b`. Pick **WhatsApp Tennis Club**, not Pilot Tennis Club (latter is in-app queue cohort 1 doesn't use).

**Verify:**

- Match fills, reaches agreed time
- "Book on WhatsApp" opens prefilled message
- Recording the court moves status to `confirmed`

**Authorization check:** deliberately try to confirm the court as `player-b`. Migration `058` restricts that to the host — prove it, don't assume.

---

## Workflow 3 — Result and rating

Can't reach by tapping alone. Match turns `in_progress` after agreed hour passes; auto-confirm and grace windows are measured in days.

Drive from outside (refuses non-localhost):

```bash
node scripts/rating-sandbox.mjs setup player-a player-b
node scripts/rating-sandbox.mjs fastforward <matchId>
node scripts/rating-sandbox.mjs state <matchId>
```

Then test in UI: attendance, score entry, confirm. Verify provisional rating rules — no precise number before provisional threshold.

---

## Workflow 4 — Safety escalation

Report a player from mobile as `player-a`. Sign into dashboard as `platform-admin@tennis-lebanon.test` and clear from `/admin/reports`.

**Verify:** resolves with audit trail, no direct database edits. Locally seeded; on staging create your own `platform_roles` row at Phase 1.7.

---

## Extra rehearsal (outside the four)

`PILOT_OPERATIONS.md` line 68: creator cancelling a full match **with a reason**, and participant withdrawing from confirmed booking inside and outside the 24-hour window. Live pilot policy from migration `029`; nothing else exercises it.

---

## Phase 0.4 — What to record

Bar is broader than crashes. Launch doc: no crashers or dead-ends across auth, onboarding, discover, create/join, hub, WhatsApp handoff, and result.

Ops guide framing is sharper: record **where you hesitated**. Every pause over what to tap next, every screen that left you unsure whether something happened, is a 0.4 fix.

Keep two lists:

| List                  | Examples                                             | Blocks              |
| --------------------- | ---------------------------------------------------- | ------------------- |
| **Hard failures**     | Crash, dead end, auth hole (player-b confirms court) | Phase 1             |
| **Hesitation points** | Confusing copy, wrong status, silent success         | Cohort A conversion |

A confused stranger doesn't file a bug — they stop.

---

## Known doc inconsistency (ignore during rehearsal)

`PILOT_OPERATIONS.md` line 484 says smoke-test in English and Arabic; cohort 1 ships English and French with Arabic hidden (decision 0.6, Phase 7.7).

---

## Outcome of this rehearsal

Findings from cohort A walkthrough are captured in [`COHORT_A_REHEARSAL_FINDINGS.md`](COHORT_A_REHEARSAL_FINDINGS.md) and the fix plan in [`COHORT_A_REHEARSAL_FIXES.md`](COHORT_A_REHEARSAL_FIXES.md).
