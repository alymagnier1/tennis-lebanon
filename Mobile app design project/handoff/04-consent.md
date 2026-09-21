# 04 — Consent

**Design:** 1a · **File:** `app/(onboarding)/consent.tsx` (+ `OnboardingStepLayout.tsx`)

Step 1 of 3. Scrollable: root `background`, content `minHeight: 100%` column,
padding `insets.top+36 / 28 / insets.bottom+30`.

## Stack

| Element       | Spec                                                           |
| ------------- | -------------------------------------------------------------- |
| Back          | `marginBottom: 22`                                             |
| Progress      | bar 1 `heroGreen`, 2–3 `secondary`; `marginBottom: 20`         |
| Eyebrow       | "STEP 1 OF 3", `eyebrow`, `mutedForeground`, `marginBottom: 8` |
| Title         | `screenTitle`, `heroOnLight`, `marginBottom: 6`                |
| Subtitle      | `bodyForm`, `mutedForeground`, `marginBottom: 22`              |
| Document card | three rows in one card, `marginBottom: 18`                     |
| Accept card   | below                                                          |
| Spacer        | `flex: 1`, `minHeight: 28`                                     |
| Continue      | 54, `tennisRadii.lg`                                           |

## Document card

`card` fill, 1.5 `border`, `tennisRadii.xl`, `overflow: hidden`.
Row: `padding: 16`, label `rowLabel` / `heroOnLight` (`flex: 1`), chevron `›` 17 `body`
`mutedForeground`. 1px `#F0F2F0` divider between rows, none after the last.
Pressed `#FAFBFA`.
Rows: Terms of Use · Privacy Notice · Community Rules — each opens `/policies` at its anchor.

## Accept card (state carrier)

`padding: 18`, `tennisRadii.xl`, `borderWidth: 2`, row `gap: 14`, `alignItems: flex-start`.
Checkbox 24×24, `borderRadius: 7`, centred glyph `bodySemi` 13.
Label `body` 13.5/19, weight 500, `heroOnLight`.

| State     | Card fill            | Card border | Box fill    | Glyph           |
| --------- | -------------------- | ----------- | ----------- | --------------- |
| Unchecked | `card`               | `border`    | `muted`     | —               |
| Checked   | `semantic.info.fill` | `heroGreen` | `heroGreen` | `✓` `onPrimary` |

Continue follows the same gate — `muted`/`mutedForeground` disabled, `heroGreen`/`onPrimary`
enabled. Disabled is a colour change, not an opacity fade, and stays focusable.

## Copy

- Title "Before you continue"; subtitle `onboarding.consent.description`
- Checkbox "I accept the Terms of Use, Privacy Notice and Community Rules"
- Continue: existing key

## Acceptance

- The three consent records still write exactly as today — visual pass only.
- Tapping a document row does not toggle acceptance.
