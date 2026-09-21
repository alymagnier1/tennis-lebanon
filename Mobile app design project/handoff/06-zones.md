# 06 — Zones

**Design:** 1a · **File:** `app/(onboarding)/zones.tsx`

Step 3 of 3. Root `background`, scrollable, `minHeight: 100%` column,
padding `insets.top+36 / 28 / insets.bottom+30`.

## Stack

Back (`mb 22`) → progress (all three `heroGreen`, `mb 20`) → eyebrow "STEP 3 OF 3" →
title "Where do you usually play?" → subtitle `onboarding.zones.description` (`mb 22`) →
Beirut card → unavailable pair → echo line → spacer (`flex: 1`, `minHeight: 28`) → "Finish setup".

## Beirut card (the only live zone)

`padding: 20`, `borderRadius: 18`, `borderWidth: 2`, `overflow: hidden`,
`marginBottom: 12`, `position: relative`.
Decorative ring 150×150, `right: -30`, `top: -30`, `borderRadius: 75`, `pointerEvents: none`.
Content row `gap: 14`: checkbox 26×26 `borderRadius: 8`, glyph `bodySemi` 14; then
`sectionTitle` "Beirut" over `body` 12 "4 pilot venues · Manara & Dekwaneh".

| State    | Card fill   | Border      | Ring           | Box fill | Glyph          | Title         | Sub                     |
| -------- | ----------- | ----------- | -------------- | -------- | -------------- | ------------- | ----------------------- |
| Idle     | `card`      | `border`    | `heroGreen` 8% | `muted`  | —              | `heroOnLight` | `mutedForeground`       |
| Selected | `heroGreen` | `heroGreen` | `white` 10%    | `lime`   | `✓` `limeText` | `white`       | `rgba(255,255,255,0.7)` |

Selected is a full colour inversion, not a tint — this is the one committed choice on the screen
and should read as such.

## Unavailable zones

Row, `gap: 10`, `marginBottom: 16`. Two cards, each `flex: 1`, `padding: 16`,
`tennisRadii.lg`, `muted` fill, 1.5 `border`, **not pressable**
(`accessibilityState: { disabled: true }`).
`bodyMedium` 14 `mutedForeground` name ("Tripoli", "Saida") over `fieldHint`
`mutedForeground` "Coming soon".
No opacity fade — the `muted` fill carries the state.

## Echo line

`padding: 14 / 16`, `tennisRadii.md`, `semantic.info.fill`, no border,
`body` 12.5/18 `semantic.info.text`.
Text: "We will only show you matches and venues in Beirut. You can add zones later from your profile."
Rendered only when a zone is selected.

## Finish setup

54, gated as `04-consent.md`: disabled until Beirut is selected.

## Acceptance

- Unavailable cards are not focusable as buttons and announce as disabled.
- Existing zone write and the redirect to `/(onboarding)/complete` are unchanged.
