# 07 — Done

**Designs:** 2f (green, default) and 2e (clay) — both ship behind the switch in
`08-hero-variant-switch.md`, resolving to the same family as Welcome.
**Renders:** `renders/done-2f.png`, `renders/done-2e.png`
**File:** `app/(onboarding)/complete.tsx`

Replace the centred `CourtGridOverlay` + 96×96 lime icon block. The new screen is a
bottom-weighted hero that mirrors Welcome, closing the loop on the same ground.
The gift block, its three states and all data hooks
(`useHomeOpenMatchPicks`, `completeGiftState`) are unchanged — only their skin changes.

## Shared structure

1. Ground, `overflow: hidden`.
2. Art, absolute, cover.
3. Bottom scrim.
4. Content — `paddingTop: insets.top + 36`, `paddingHorizontal: 28`,
   `paddingBottom: insets.bottom + 34`; `flex: 1` column.

Content stack: status pill → `flex: 1` spacer → headline → description → gift block → CTA.

**Status pill** replaces the old icon: self-start, `padding: 7 / 13`, `tennisRadii.pill`,
`statusPill` type. Text "SETUP COMPLETE" (add `onboarding.complete.statusPill`).

## 2f — green (default, pairs with Welcome 5a)

| Layer        | Spec                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Ground       | `heroGreenDeep`                                                                                                       |
| Art          | `hero-court.png`, `inset: 0`, cover, centred, `opacity: 0.55`                                                         |
| Bottom scrim | height 420 — `rgba(10,45,38,0)` → `rgba(10,45,38,0.78)` at 30% → `rgba(10,42,34,0.95)` at 64% → `rgba(10,40,32,0.98)` |

- Pill: `lime` fill, `limeText` text.
- Headline `heroDisplay`: line 1 `white`, line 2 `lime`. Uses
  `onboarding.complete.title` and `titleAccent` (with `name`) as today — left-aligned now, not centred.
- Description `bodyLead` `rgba(255,255,255,0.72)`, `maxWidth: 300`, `marginBottom: 22`.
- Gift block: rows keep `heroOverlay` fill and `heroBorder` border; `giftTitle`
  `headingSemi` 16 `white` **left-aligned**; `giftOpen` and `giftScarce` `lime`.
- CTA `lime`, `marginTop: 16`. Empty/error state secondary stays `ghostOnDark`.

## 2e — clay (pairs with Welcome 2a)

| Layer        | Spec                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Ground       | `heroClay`                                                                                                  |
| Art          | `hero-racket-cream.png`, `top: 0`, `bottom: 300`, cover at `center 40%`, soft bottom edge fading out by 88% |
| Bottom scrim | height 340 — `rgba(232,220,194,0)` → `rgba(232,220,194,0.92)` at 38% → `heroClay` at 76%                    |

- Pill: `heroGreen` fill, `onPrimary` text.
- Headline `heroDisplayTall` (56/52, −2.9) — two short lines. Line 1 `heroOnLight`,
  line 2 `heroGreen`.
- Description `bodyLead` `rgba(13,28,20,0.7)`.
- Gift block on light: rows `card` fill, 1.5 `border`, `tennisRadii.lg`;
  `giftTitle` `heroOnLight`; `giftHost` `heroOnLight`; `giftMeta` `mutedForeground`;
  `giftOpen` and `giftScarce` `heroGreen`.
- CTA `primary` (green); empty/error secondary `ghostOnLight`.

The clay variant needs the light gift-row skin — do not reuse `heroOverlay` on it; white at
12% over clay is invisible.

## Acceptance

- All three gift states (`listings`, `empty`, `error`) render correctly in **both** variants —
  check the light skin explicitly.
- With three gift rows and a long display name the screen scrolls and the CTA stays pinned
  and reachable.
- `router.replace("/(tabs)")` on CTA unchanged.
- Done resolves to the same family as Welcome on every launch.
