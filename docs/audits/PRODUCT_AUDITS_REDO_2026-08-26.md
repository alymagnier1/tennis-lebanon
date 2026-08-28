# Product audits re-run: Tennis Lebanon

**Skills:** `steve-jobs-design-review`, `influence-psychology`  
**Date:** 2026-08-26 (evening, after Home carousel + influence fixes)  
**Method:** Code review against current branch; three defects verified directly in source.

**New defects found at re-run:**

- Complete screen gift-listing error renders nothing (no error branch)
- Discover can show an error and an empty state simultaneously
- `home.firstPlay.setup*` keys orphaned in all three locales after carousel change

Several of these were fixed in the same session. See [`../CHAT_AUDITS_INDEX.md`](../CHAT_AUDITS_INDEX.md).

---

# Design Review: Tennis Lebanon (player app)

**Verdict:** NOT DONE — **3 of 5 product rows fail**

**The One Thing:** Get two compatible players onto a court at an agreed time, and record that the match happened.

**Keeps its promise?** No — not yet. Welcome promises _"Find Your Match. Play Today."_ The fastest honest path from cold open to a published or joined match is **15–16 in-app taps plus an external email round-trip**: sign-in (2 taps), magic link in a mail client, consent, identity (name, birth-year picker, year selection, adult toggle, skill band), zones, complete, then create. "Play Today" is achievable, but not before a mail app and five screens.

## Quick diagnostic — 2 of 7 pass

| Row                                     | Result                                        |
| --------------------------------------- | --------------------------------------------- |
| One Thing stated in a sentence          | Pass                                          |
| New user reaches core value in ≤3 steps | Fail — 14 taps to Home                        |
| Reviewer experienced it cold            | Fail — code review, no device run             |
| Working demo on the real device         | Fail — Maestro flows exist, none run          |
| Something removed this cycle            | Pass — stacked setup empty, three-empty stack |
| Error/empty/edge match hero quality     | Fail — see back of the fence                  |
| Team would proudly sign it              | Fail — follows from the above                 |

Two of those failures — "reviewer experienced it cold" and "working demo on the real device" — grade the **review method**, not the build. A code-only audit fails both by construction, so they are excluded from the verdict: the product fails three of the five rows that are about the product.

**No single score is given, deliberately.** An earlier pass in the same chat recorded 6/10; counting the two process rows as product failures would report a drop to 3/10 across a window in which the product measurably improved (Welcome unity, the Complete gift, the Home carousel). A number that moves opposite to the thing it measures is worse than no number. The findings below stand on their own evidence — three defects verified directly in source — and that is what should be acted on.

## Cut list

- Orphaned `home.firstPlay.setupTitle`, `setupBody`, `addHours`, `addClubs`, `skipOrganise` keys in `en.json`, `ar.json`, and `fr.json`
- Unused `discover.loading` key — defined at `en.json` L778, referenced nowhere in Discover
- Birth-year picker's second tap (modal + year selection = two taps for one fact)
- `review.tsx`, `tennis-profile.tsx`, `enable-notifications.tsx` under `(onboarding)`, plus `match/create/review.tsx` — redirect-only stubs from cut flows

## Fix list

1. **Complete screen swallows its own failure.** `completeGiftState` returns `{ kind: "error" }`; `complete.tsx` renders only `listings` and `empty`. Add error branch with retry, or fall through to organise CTA.
2. **Error and empty render together.** Discover error block does not suppress empty state; same pattern in Matches → Active and Completed. Guard every empty on `!isError`. Violates `.cursor/rules/mobile-ui-ux.mdc`: "Never show empty when a query failed."
3. **Match hub error has no way out.** Pull-to-refresh only; add Try again button like comparable screens.
4. **Cut path to first value.** Fold adult confirmation into birth year; drop year modal — loses three taps without losing a fact.
5. **Zones shows "No pilot areas are available yet." inside `ErrorNotice`.** Empty pilot region is normal state, not failure styling.
6. **Run it on a device.** First-open Home, carousel swipe, WhatsApp hand-off never walked since carousel change.

## Back of the fence

Auth callback shows "Signing you in" with no spinner. Complete gift fails silently. Three empty states double as error states. Dead i18n keys in all three locales. `HomeNextActionsCarousel.tsx` puts `accessibilityLabel` on a bare `View` with no `accessible` prop — VoiceOver won't announce page count.

---

# Influence Audit: Tennis Lebanon

**Score: 7/10** (up from 6/10 earlier in chat). **Ethics gate: passes.**

Lift comes from work already shipped: Welcome names a tribe, onboarding echoes choices back, Complete gives before it asks.

## What is working

- **Commitment** — identity echoes band; zones echo areas; carousel adds hours/clubs micro-commitments
- **Unity** — "For adult players in Lebanon who want a match at the right level — not a feed. We don't use UTR or NTRP; you pick a band."
- **Reciprocity** — Complete offers overlapping open matches; Home leads with open matches and free players
- **Scarcity** — every urgency claim traces to data (`open-match-scarcity.ts`, `court_secured`, `is_stale_warning`); no fake timers or crowd numbers

## Diagnostic

| Question                             | Result                                   |
| ------------------------------------ | ---------------------------------------- |
| Which principles are used            | Commitment, unity, reciprocity, scarcity |
| Combining principles                 | Yes, on Welcome and Complete             |
| Truthful                             | Yes — every count data-derived           |
| Helps the user                       | Yes                                      |
| Works if the user knows the strategy | Yes                                      |
| Reversible                           | Yes                                      |
| Safe for vulnerable users            | Yes — 18+ gate, no fabricated pressure   |

## Why it is not a 9

1. **Authority absent** — no credibility signal for birth year / area collection. One honest pilot line would help.
2. **Social proof thin after sign-in** — `useHomeLiquidityOffers` computes free-player counts but copy doesn't use them.
3. **Reciprocity fragile** — Complete gift disappears silently on query failure (same defect as Jobs fix #1).

## To reach 10/10

Add the honest authority line, surface the free-players count already computed on Home, and make the Complete gift fail loudly instead of silently. Nothing needs to become less truthful.

---

## Note on onboarding tap count

The 14-tap onboarding was flagged as a Jobs fix. **Do not act on it before cohort A.** Gate 7.3 (≥80% complete onboarding without ops help) measures whether taps are a real problem on real players. If cohort A clears 80%, cutting taps optimizes against opinion instead of evidence.
