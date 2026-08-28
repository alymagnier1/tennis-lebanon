# Cold-start recruiting: atomic network for cohort A

**Skill:** `cold-start-problem`  
**Date:** 2026-08-27  
**Context:** Pre-pilot audit — demand-side density before recruiting cohort A.

---

## The core move

Build one tiny complete network first — an **atomic network**. For Tennis Lebanon that is not "50 players in Lebanon." It is:

> Intermediate / upper-intermediate adults in **one Beirut corridor**, free on the **same 2–3 weekday evenings**, who can book one of the **four Manara/Dekwaneh clubs**.

If that pocket produces a match without babysitting, the loop is real. If it can't, recruiting 300 won't fix it — you get a bigger empty Discover.

---

## Hard side first

The hard side is the **organiser** — creates listing, invites, books WhatsApp, confirms court. Joiners are the easy side.

For cohort A:

1. Recruit **organisers** first (people who already arrange games on WhatsApp).
2. Pre-seed **3–5 open matches** in that pocket before the wave opens Discover.
3. Tell joiners "there are games tonight," not "come explore."

If organisers don't create, Discover stays empty no matter how many signups you have.

---

## Density over diversity

Recruiting a "mix of skill levels" is the trap. Five bands × one zone × evening availability = too thin.

For the first 20–50:

- Weight to **three centred bands** — Improving / Intermediate / Advanced, Intermediate the largest — not all five.
- Same 1–2 zones only.
- Prefer people who already play each other or know each other from a club/group.

Density feels niche; emptiness feels like a failed product.

### Why three and not two

This audit first argued for **two adjacent bands**, which is strictly denser: `DEFAULT_LEVEL_WINDOW` is `1` (`packages/domain/src/discovery.ts`), so in a two-band cohort every player can see every other one. Three was chosen instead — see `DECISIONS.md`, 2026-08-27 — so the Advanced end is represented before cohort B rather than recruited cold later.

The cost is accepted, not avoided: discovery matches ±1 band, so **Improving and Advanced players cannot see each other at all**. Intermediate is the only bridge between them.

That is survivable at 10–20 players, since an Improving player still reaches Improving + Intermediate. But it makes the Intermediate middle load-bearing. Recruit that middle thin and cohort A is two disconnected pools wearing one cohort's name — and the completed-match count will not tell you that is what happened, because both pools keep producing matches internally. Watch the middle, not the total.

---

## Flintstone until it stands alone

Until liquidity is real, **you** are the missing side:

- Personally match people ("Karim is free Thu 7 — want me to open a listing?").
- Create the first listings yourself if needed.
- Nudge WhatsApp booking and result confirm so the magic moment happens.

Flintstoning = real human work. Not fake players, not fake "12 people viewing."

---

## Magic moment and gate

Magic moment is not "signed up." It is:

> Someone finds / creates a compatible match → time is agreed → court is recorded → they play.

Cohort A go/no-go already points here (≥2 completed match attempts). Do **not** expand to cohort B on signup count alone.

---

## Single-player value while the room is empty

While density builds, the app must feel useful for one person:

- Hours + preferred clubs (already on Home).
- Create a listing for tonight even if nobody joins yet.
- Rematch / invite someone they already know outside the app.

Stops day-one bounce before the network catches up.

---

## What not to do

- Big invite blast across Beirut / all levels.
- Measuring success as "50 signed up."
- Opening a second zone or Arabic / more clubs before the first pocket tips.
- Hoping Discover fills itself without seeded organisers and listings.

---

## Practical sequence

| Step | Do this                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| 1    | Lock atomic network: **Beirut + 3 centred bands + weekday evenings + 4 clubs** |
| 2    | Recruit 8–12 organisers in that pocket (cohort A core)                         |
| 3    | Pre-seed open matches before they open Discover                                |
| 4    | Matchmake / nudge until ≥2 full loops complete                                 |
| 5    | Only then invite the next 25–50 **into the same pocket**                       |
| 6    | Tip the next pocket later with the same playbook                               |

The launch doc already got geography and clubs right. The remaining lever is **who** you recruit and **how dense** that first pocket is — not more features.

**Applied to docs:** Phase 7.1 skill-mix wording updated in `PILOT_50_PLAYER_LAUNCH.md` (weight toward improving / intermediate / advanced; intermediate as hub).
