# Design Review: Tennis Lebanon

**Skill:** `steve-jobs-design-review`  
**Date:** 2026-08-26  
**Branch context:** Steve-Jobs-Design-Audit (pre–Home carousel)  
**Verdict:** NOT DONE (score **6/10**)  
**The One Thing:** Get a compatible player, agree a time, lock a court, and play.  
**Keeps its promise?** No — welcome says “Play Today,” but first completed match sits behind magic-link auth, ~6 onboarding steps, create/join, optional voting, and off-app WhatsApp booking (`showRequestCourt = false`).

**Cut list:** Home rating/stats dashboard; Discover sort/filter chrome by default; flexible multi-slot voting for v1; “track your game” on welcome; dual equal Publish/Invite CTAs; pilot “development drafts” trust copy.

**Fix list:**

1. One Home next action above the fold — re-enable or delete `SHOW_HOME_NEXT_ACTIONS`
2. After onboarding, land on joinable matches / free slots, not clubs first
3. Match hub: status + one CTA above fold, collapse the rest
4. Shorten onboarding (merge review, defer notifications/clubs)
5. Empty Home sections get a CTA, never silent `null`
6. Fix plywood (consent drafts, check-email craft, hub mojibake)

**Back of the fence:** Consent admits draft policies; Home empties go quiet; check-email is emoji-grade; hub copy shows encoding glitches — hero screens get craft, seams don’t.

---

## Quick diagnostic (4/7 → 6/10)

| Row                                    | Result                                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| One Thing in one sentence              | Pass — PRD north star is clear                                     |
| ≤3 steps to core value                 | **Fail** — email gate + onboarding + coordinate + off-app court    |
| Experienced cold                       | Pass — screens/flows reviewed without a guided demo                |
| Working end-to-end demo of the promise | **Fail** — court confirmation leaves the product                   |
| Anything removed this cycle            | Pass — create collapsed to schedule; next-actions deliberately cut |
| Error/empty/edge = hero quality        | **Fail**                                                           |
| Would you sign it and use daily        | **Fail** — ops suite energy, not “tonight’s hit”                   |

---

## Cold walkthrough (what a player feels)

1. **Welcome** — “Find Your / Match. / Play Today.” is strong; body immediately adds book + schedule + **track your game**. Two equal doors (Create / Sign In) to the same email form.
2. **Auth** — Magic link forces leave-app → email → return. The front door is the inbox, not tennis.
3. **Onboarding** — Consent → identity → tennis profile → zones → notifications → review → then **Where I play / clubs**. Setup theater before liquidity.
4. **Home** — Greeting, provisional rating bar, stats, free slots, open matches, upcoming. The thing that should scream “do this now” (`HomeNextActionCard`) is **flagged off** with a comment that it “duplicates” browse. Cold read: a dashboard, not a next hit.
5. **Discover** — Players/matches segments, four filter chips, time chip, search, four sorts. Empties are good (“Organise a match” / relax filters). Default is **players**, not open matches — slower path to a ball in play.
6. **Create** — Hydrate → one dense schedule screen (when, zones, clubs, list/approve, notes, Publish **and** Invite). Better than a wizard; still not “one window, burn.”
7. **Match hub** — Action bar exists, but scroll stacks banners, clubs, participants, votes, chat, results, rematch, withdraw. Next action shares the stage with tennis ops.

Architecture already knows the One Thing (`next_action`, free-slot → Discover, profile defaults for create). The cold UI still sells a **platform**.

---

## Principle audit (brief)

- **Simplicity:** Complexity is not conquered — it’s distributed across onboarding, Home chrome, Discover filters, and hub sections.
- **Focus:** Tab bar is focused (Home / Discover / + / Matches / Profile). Surface content is not: rating on Home, flexible voting, Discover cockpit.
- **How it works:** Booking “works” by WhatsApp. Failure/empty on Home often vanish instead of recovering into a create/join CTA.
- **Whole experience:** Auth email and consent trust surfaces are part of the product; they feel provisional.
- **Taste / back of fence:** Discover empties show care; consent drafts and silent Home empties don’t. Plywood where “nobody demos.”

---

## Path to 10/10

Ship when a cold player can answer, without a walkthrough: **“What do I do right now to play?”** — and do it in a short path that stays inside the product through court confirmation. Until Home forces one next hit and first-run ends in a joinable match, this stays **NOT DONE**.

**Superseded by:** [`PRODUCT_AUDITS_REDO_2026-08-26.md`](PRODUCT_AUDITS_REDO_2026-08-26.md) (re-run after Home carousel changes).
