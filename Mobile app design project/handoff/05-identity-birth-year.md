# 05 — Identity and birth year

**Design:** 1a · **Files:** `app/(onboarding)/identity.tsx`,
`src/components/onboarding-ui/OnboardingYearField.tsx`, `SelectionCards.tsx`, `FigmaChipGroup.tsx`

Step 2 of 3, the longest screen. Root `background`, scrollable,
padding `insets.top+36 / 28 / insets.bottom+30`.

## Stack

Back (`mb 22`) → progress (1–2 filled, `mb 20`) → eyebrow "STEP 2 OF 3" →
title "Tell us about yourself" → subtitle `onboarding.identity.description` (`mb 24`) →
photo card → display name → **birth year** → gender → languages → adult confirmation →
divider → tennis profile block → Continue.

## Photo card

Row, `padding: 16`, `card`, 1.5 `border`, `tennisRadii.xl`, `gap: 16`, `marginBottom: 22`.
Avatar 64×64 circle — empty: `secondary` fill, `heroGreen` initial at `heading` 22;
set: `lime` fill, `limeText` initial.
Right column: `heading` 15 `heroOnLight` ("Add a photo" / "Photo added"), then
`fieldHint` `mutedForeground` `maxWidth: 190`:
"Players recognise a face faster than a name. You can add one later instead."

## Display name

`fieldLabel` "Display name" + standard input (`02-sign-up.md`), `marginBottom: 18`.

## Birth year — `OnboardingYearField`

Replace any picker or wheel with a three-part stepper. Row, `gap: 10`, `marginBottom: 6`:

- **−** 48×52, `card`, 1.5 `border`, `tennisRadii.md`, glyph `−` `body` 20 `heroOnLight`
- **value** `flex: 1`, height 52, same surface, `bodySemi` 17,
  `fontVariant: ["tabular-nums"]`, centred
- **+** mirror of −

Pressed border `heroGreen`. Long-press repeats every 120 ms after a 400 ms delay.
Clamp to `[currentYear − 100, currentYear − 18]`; at a bound the control renders
`mutedForeground` and does not fire.
Hint below, `fieldHint` `mutedForeground`, `marginBottom: 20` — shows the computed age
("You are 34"), or the critical tone when the adult gate fails.

`onboarding-identity-validation.ts` stays the source of truth; the stepper only constrains input.

## Chip groups — gender, languages, play style

Label `fieldLabel` `mb 8`; wrap row `gap: 8`, `marginBottom: 20` (24 after play style).
Chip `padding: 11 / 16`, `tennisRadii.pill`, `borderWidth: 2`, `bodyMedium` 13.

| State    | Fill                 | Text              | Border      |
| -------- | -------------------- | ----------------- | ----------- |
| Idle     | `card`               | `mutedForeground` | `border`    |
| Selected | `semantic.info.fill` | `heroGreen`       | `heroGreen` |

Gender single-select and optional; languages and play style multi-select.

## Adult confirmation

The consent accept card (`04-consent.md`) with `padding: 16`, `alignItems: center`,
`marginBottom: 28`. Label "I confirm that I am 18 or older".

## Tennis profile block

1px `border` rule, `marginBottom: 22`. `sectionTitle` "Your tennis profile" `mb 4`;
`body` 13/19 `mutedForeground` `onboarding.tennisProfile.description`, `mb 14`.

Five band cards, `gap: 8`, `marginBottom: 20`. Each: row, `padding: 15 / 16`,
`tennisRadii.lg`, `borderWidth: 2`, `gap: 14`.

**Level meter** — five 4-wide bars, `gap: 2`, bottom-aligned, heights 6 / 10 / 14 / 18 / 22,
`borderRadius: 1`. Bars up to and including the band's ordinal use the band's `text` colour
from `tennisSkillBands`; the rest `border` when idle, band text at 25% when selected.

| State    | Fill        | Border      | Title         | Description        |
| -------- | ----------- | ----------- | ------------- | ------------------ |
| Idle     | `card`      | `border`    | `heroOnLight` | `mutedForeground`  |
| Selected | band `fill` | band `text` | band `text`   | band `text` at 72% |

Title `heading` 14.5; description `body` 11.5/15. Band labels and descriptions unchanged.

## Error and Continue

Error block above the button: `padding: 13 / 15`, `tennisRadii.md`,
`semantic.critical.fill` / `.border` / `.text`, `bodyMedium` 12.5/18, `marginBottom: 12`.
Text: "Some required details are missing. Check the highlighted fields above, then try again."
Continue gated exactly as `04-consent.md`.

## Acceptance

- The stepper works under VoiceOver: `accessibilityRole="adjustable"` on the value,
  responding to increment and decrement.
- Band cards pass 4.5:1 for title and description on their own fill — check `intermediate`
  (lime fill) in particular.
- `submit-onboarding.ts` payload unchanged.
