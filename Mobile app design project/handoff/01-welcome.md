# 01 — Welcome

**Designs:** 5a (green, default) and 2a (mint) — both ship behind the switch in
`08-hero-variant-switch.md`. 5c (clay) is specced below but not wired.
**Renders:** `renders/welcome-5a.png`, `renders/welcome-2a.png`, `renders/welcome-5c.png`
**Files:** `app/(public)/welcome.tsx`, `src/components/onboarding-ui/AuthHeroLayout.tsx`

## Rework `AuthHeroLayout`

Delete the placeholder chrome: `decorCircleOuter`, `decorCircleInner`, `ball`, `ballStripe`,
and the `✕` `logoMark`. Real art and the real icon replace them.
`CourtGridOverlay` is no longer used on this screen.

The component takes a `variant` ("green" | "light") and renders the matching field.
Layers, back to front:

1. **Ground** — `flex: 1`, `overflow: hidden`, `backgroundColor` per variant.
2. **Art** — absolute, cover.
3. **Top scrim** (green only) — absolute top.
4. **Bottom scrim** — absolute bottom; this is what the buttons and description sit on.
5. **Content** — `paddingTop: insets.top + 36`, `paddingHorizontal: 28`, `paddingBottom: insets.bottom + 34`.

## 5a — green plate (default)

| Layer        | Spec                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Ground       | `heroPlate` `#3F7A5C`                                                                                                 |
| Art          | `mid-lines-court.png`, `inset: 0`, cover, centred                                                                     |
| Top scrim    | height 300 — `rgba(10,45,38,0.72)` → `rgba(10,45,38,0.18)` at 68% → `rgba(10,45,38,0)`                                |
| Bottom scrim | height 330 — `rgba(18,54,40,0)` → `rgba(18,54,40,0.82)` at 26% → `rgba(16,48,36,0.94)` at 58% → `rgba(14,44,33,0.97)` |

Content stack:

| Element     | Spec                                                                               |
| ----------- | ---------------------------------------------------------------------------------- |
| Logo row    | `rb-icon-lime.png` 34×34 `contain`, `gap: 10`, wordmark `wordmark` / `white`       |
| Headline    | `marginTop: 36`, `heroDisplayPlate`. Line 1 `white`, line 2 `lime`, line 3 `white` |
| Spacer      | `flex: 1`                                                                          |
| Description | `bodyLead`, **full-opacity `white`**, `maxWidth: 288`, `marginBottom: 22`          |
| Buttons     | `gap: 10` — `lime`, then `ghostOnDark`, then the terms line                        |
| Terms       | centred, `paddingTop: 6`, `bodyMedium` 12, `rgba(255,255,255,0.55)`                |

The description is full-opacity white here, not the usual 0.72 — the plate art is light
enough that muted text falls under 4.5:1.

## 2a — mint ground

| Layer        | Spec                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Ground       | `heroMint` `#A7C7AF`                                                                                                    |
| Art          | `hero-balls-net.png`, `top: 255`, `bottom/left/right: 0`, cover at `center 78%`; soft top edge fading in to full by 26% |
| Top scrim    | none                                                                                                                    |
| Bottom scrim | height 214 — `rgba(12,56,46,0)` → `rgba(10,31,24,0.62)` at 40% → `rgba(10,31,24,0.86)`                                  |

Ink flips: mark `rb-icon-dark.png`; wordmark and headline lines 1+3 `heroOnLight`,
line 2 `heroGreen`; description `rgba(13,28,20,0.68)`.
Headline margin `46 / 0 / 16`, `heroDisplayPlate`.
The description sits **inside** the `flex: 1` spacer, top-aligned under the headline — not
directly above the buttons as in 5a.
Buttons stay `lime` + `ghostOnDark` because they land on the dark bottom scrim.
Terms line `rgba(255,255,255,0.55)`.

## 5c — clay (specced, not wired)

Ground `heroClay`; art `mid-lines-cut.png` cover centred with
`shadowOpacity 0.14 / radius 14 / offsetY 6`.
Bottom scrim height 216 — `rgba(232,220,194,0)` → `rgba(232,220,194,0.9)` at 44% → `heroClay` at 82%.
Mark `rb-icon-dark.png`; headline `heroDisplay` full 46/46, lines 1+3 `heroOnLight`, line 2 `heroGreen`.
Description `rgba(13,28,20,0.68)`. Buttons `primary` + `ghostOnLight`; terms `rgba(13,28,20,0.72)`.

## Copy and routing — unchanged

| Element     | Key                                                  |
| ----------- | ---------------------------------------------------- |
| Wordmark    | `common.appName`                                     |
| Headline    | `welcome.headline1` / `2` / `3`, `highlightIndex: 1` |
| Description | `welcome.description`                                |
| Primary     | `welcome.createAccount` → `/(public)/sign-up`        |
| Secondary   | `welcome.logIn` → `/(public)/sign-in`                |
| Terms       | `welcome.termsFooter` → `/policies`                  |

## Acceptance

- Headline does not wrap at 402 wide in either variant.
- At `fontScale` 1.3 the description truncates before the buttons leave the screen.
- Dark mode renders identically to light (hero tokens are scheme-independent).
- Description contrast ≥4.5:1 measured against the scrim actually behind it, not the ground.
- Switching variant does not remount the navigator or reset auth state.
