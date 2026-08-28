# Influence audit: Tennis Lebanon

**Skill:** `influence-psychology` (Cialdini)  
**Date:** 2026-08-26  
**Branch context:** Steve-Jobs-Design-Audit (pre–Welcome/Complete fixes)  
**Score:** 6/10  
**Band:** One or two principles are real and honest; the rest is luck. Welcome and empty states leave leverage on the table. Ethics gate **passes** — nothing here is fake scarcity, fake proof, or a trapped yes.

The product already _is_ the user’s goal (find a player, play). Persuasion should make that yes easier, not invent a second product.

---

## Quick diagnostic

| Question                               | Result                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which principles are you using?        | **Commitment** (onboarding + votes + confirm court). **Liking** (named invites, rematch, faces). **Scarcity** (spots left, expiring, court held) as facts, not as a campaign. |
| Combining principles?                  | **Partly** — only after someone is in a match. Welcome layers almost nothing.                                                                                                 |
| Truthful?                              | **Yes.** No fake timers, no invented user counts, no UTR/NTRP cosplay.                                                                                                        |
| Helps the user?                        | **Yes** when it pushes join / vote / invite / confirm court. **No** when empty copy says the room is empty.                                                                   |
| Still works if they know the strategy? | **Yes** for invites, rematch, spots, expiry.                                                                                                                                  |
| Easy to reverse?                       | **Yes** — leave/withdraw, skip clubs, skip push, decline invite.                                                                                                              |
| Safe for vulnerable users?             | **Mostly** — adult-only, no public shame score, no payments. Don’t add FOMO that pressures distressed players to over-commit.                                                 |

---

## Principle by principle

**1. Reciprocity — weak**  
The user pays first (email, policies, profile, skill, zones) before the app gives a match. Complete even has unused `playersNearby` / `courtsAvailable` keys and never shows a gift.  
Fix: after Finish, show **real** open matches in their zones (“Here are tonight’s listings”) _then_ “Start playing.” Gift before the next ask.

**2. Commitment & consistency — strongest (designed)**  
Adult tick, “I can rally and play points,” zones, then votes and “I booked the court” are a clean foot-in-the-door. Home next-action (“You said you’d host — invite someone”) is consistency done right.  
Gap: after the skill pick, nothing says “Based on that, we’ll show Intermediate matches.” The commitment isn’t reflected back.

**3. Social proof — present in the product, missing at the door**  
Discover counts, “players free this slot,” overlap hints, named “{{name}} invited you” (wisdom of a similar other).  
Welcome has **zero** crowd proof. Empty Home/Discover is **negative** proof (“Nobody listed as free,” “No open matches nearby”) — Cialdini: that teaches people the norm is emptiness.  
Fix: never lead with “nobody.” Lead with agency (“Add when you play so others can find you”). On Welcome, only show a number if it’s true (“12 open matches in Pilot Central this week”). If the number is 0, don’t fake it — use unity instead.

**4. Authority — unused (honestly)**  
You correctly refuse fake rankings. That’s a trust asset you don’t spend. Clubs exist, but the story is WhatsApp, not “these venues are how Beirut plays.”  
Fix: one truthful line — partner/listed club names, or “We don’t use UTR. You pick a band; results move it.” Weakness-first authority.

**5. Liking — medium, and earned**  
Named rematch, host faces, “Play {{name}} again,” optional photo because “players recognise a face.” Warm enough; not Mailchimp-cute, which fits tennis.  
Keep it. Don’t add generic “Awesome!!”

**6. Scarcity — ethical and under-shown**  
Real: `spotsRemaining`, “Expiring soon,” “Court booked, players missing.” That’s quantity + time + loss of a held court.  
Welcome/onboarding don’t use it. Home “Waiting for players” is softer than “Your court is held.”  
Fix: when `has_court`, the Home hero should use the court-secured copy you already wrote. Never add a resetting countdown.

**7. Unity — the brand has it; the first screen dropped it**  
The tribe is **adult recreational tennis in a Lebanese zone**, not “athletes worldwide.” Welcome is now “Find someone at your level and play today” — accurate, anonymous. Onboarding still asks languages and areas (unity ingredients) without saying “us.”  
Fix: “For players in Lebanon who want a match at the right level — not a feed.” Define “us” without a villain (not “unlike WhatsApp chaos” as contempt; “instead of 40-message threads” is shared struggle).

---

## Where the yes actually happens

| Surface    | What’s working                                  | What’s leaking                                         |
| ---------- | ----------------------------------------------- | ------------------------------------------------------ |
| Welcome    | Clear job                                       | No tribe, no proof, no gift                            |
| Onboarding | Commitment ladder                               | Ask-heavy; no “based on what you told us”              |
| Complete   | CTA to play                                     | Fake-adjacent unused stats keys; no real listings gift |
| Home       | Next action + rematch + rating bar you restored | Empty liquidity as negative proof                      |
| Discover   | Similar-other chips, spots left                 | Default empty copy trains “this app is empty”          |
| Hub        | Invite / WhatsApp / confirm as one job          | Fine — don’t add fake urgency here                     |

---

## Ethics gate (must stay 10/10 on this even if persuasion is 6)

- Do **not** invent “2,347 players” or a timer that resets.
- Do **not** public-shame no-shows.
- Do **not** pressure join with fake “12 people viewing.”
- Adult-only stays. Optional photo stays optional.
- Pilot-scale proof: specific, local, current — or omit.

---

## Path to 9–10 (layer, don’t decorate)

1. **Welcome = Unity + Authority-as-honesty.** One sentence: Lebanon, your level, no fake ranking.
2. **Complete = Reciprocity.** Show real open matches (or “organise the first one in your area”) before they hunt.
3. **Reflect commitment.** After skill/zones: “We’ll look for {{band}} in {{areas}}.”
4. **Kill negative social proof.** Empty states = what _you_ can do, not “nobody’s here.”
5. **Put real scarcity on the Home hero** when a court is held or one spot remains — copy you already have.
6. **Social proof only when true.** Count of open matches in their zones on Home/Welcome; hide if zero.

Do those six and you layer commitment + reciprocity + similar-other proof + ethical scarcity + unity without a dark pattern. That’s a **9**. A **10** is the same stack still working when the user knows you’re doing it — which this product can, because the facts (invites, spots, held courts, named rematch) are already real.

**Superseded by:** [`PRODUCT_AUDITS_REDO_2026-08-26.md`](PRODUCT_AUDITS_REDO_2026-08-26.md) (re-run after influence fixes shipped).
