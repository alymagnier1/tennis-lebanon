# 00 — Tokens and primitives

Apply first. Nothing here changes an existing token value; it only adds.

## 1. Hero ground colours

Add to **both** `tennisColorsLight` and `tennisColorsDark` in
`apps/mobile/src/theme/tennis-tokens.ts`, with identical values in both.

```ts
// Hero grounds — full-bleed onboarding art fields, deliberately scheme-independent.
heroGreen: "#0C382E",      // == light primary. Aliased so hero screens don't read primary.
heroGreenDeep: "#0A2D25",  // top of the 5a scrim
heroGreenLift: "#124436",  // bottom of the 5a scrim
heroPlate: "#3F7A5C",      // 5a ground beneath the court art
heroInk: "#0A1F18",        // deepest scrim colour (2a bottom)
heroMint: "#A7C7AF",       // 2a ground
heroClay: "#E8DCC2",       // 2e / 5c ground
heroOnLight: "#0D1C14",    // == light primaryDark. Ink on mint and clay.
```

Why aliases: in dark mode `primary` is `#8B6DFF` and `primaryDark` is `#F3F4F0`.
The onboarding hero art must not invert, so it reads `heroGreen` / `heroOnLight`.
The **form** screens (Sign up, Log in, Consent, Identity, Zones) do follow the scheme
normally via `background` / `card` / `border`.

## 2. Radius

`tennisRadii` gains one entry:

```ts
control: 11,   // 38×38 back button
```

Use radii by name:

| Use                                   | Value | Token                         |
| ------------------------------------- | ----- | ----------------------------- |
| Input, year stepper, progress pill    | 12    | `md`                          |
| Button, band card, zone tile          | 14    | `lg`                          |
| Consent card, accept card, photo card | 16    | `xl`                          |
| Zone card (large, selected)           | 18    | `xl + 2` — do not add a token |
| Chip, status pill                     | 20    | `pill`                        |
| Back button                           | 11    | `control` (new)               |

## 3. Spacing

`tennisSpacing.screenX: 28` is already correct.
Form screens: `paddingTop: insets.top + 36`, `paddingBottom: insets.bottom + 30`.
Hero screens: same top, `insets.bottom + 34`.

## 4. Type ramp

Put these in `apps/mobile/src/theme/tennis-text-styles.ts` and import them.
No screen file should repeat the numbers.

| Name               | Family         | Size / line | Tracking    | Used on                          |
| ------------------ | -------------- | ----------- | ----------- | -------------------------------- |
| `heroDisplay`      | `headingExtra` | 46 / 46     | −2.1        | Welcome 5c, Done 2f headline     |
| `heroDisplayPlate` | `headingExtra` | 44 / 44     | −2.0        | Welcome 5a, Welcome 2a           |
| `heroDisplayTall`  | `headingExtra` | 56 / 52     | −2.9        | Done 2e (two short lines)        |
| `screenTitle`      | `headingExtra` | 29 / 32     | −0.8        | every form screen h1             |
| `sectionTitle`     | `heading`      | 19 / 24     | −0.4        | "Your tennis profile", zone name |
| `wordmark`         | `heading`      | 18 / 22     | −0.4        | "RacketBound" beside the mark    |
| `buttonLabel`      | `heading`      | 16 / 20     | −0.2        | primary + secondary buttons      |
| `bodyLead`         | `body`         | 14.5 / 23   | 0           | hero description                 |
| `bodyForm`         | `body`         | 13.5 / 20   | 0           | form screen subtitle             |
| `rowLabel`         | `bodyMedium`   | 14 / 20     | 0           | consent row, chip                |
| `fieldLabel`       | `bodyMedium`   | 12 / 16     | 0           | input labels                     |
| `fieldHint`        | `body`         | 11.5 / 16   | 0           | hint under an input              |
| `eyebrow`          | `bodySemi`     | 11 / 15     | +1.2, upper | "STEP 2 OF 3"                    |
| `statusPill`       | `bodySemi`     | 11 / 15     | +0.6, upper | "SETUP COMPLETE"                 |

## 5. Buttons — `FigmaButtons.tsx`

All variants: `buttonLabel` type, `tennisRadii.lg`, full width, centred label.

| Variant            | Height | Background               | Label         | Border                       |
| ------------------ | ------ | ------------------------ | ------------- | ---------------------------- |
| `lime`             | 54     | `lime`                   | `limeText`    | —                            |
| `primary`          | 54     | `heroGreen`              | `onPrimary`   | —                            |
| `ghostOnDark`      | 50     | `rgba(255,255,255,0.10)` | `white`       | 1.5 `rgba(255,255,255,0.20)` |
| `ghostOnLight`     | 50     | transparent              | `heroGreen`   | 1.5 `rgba(12,56,46,0.32)`    |
| `neutral` (Google) | 50     | `card`                   | `heroOnLight` | 1.5 `border`                 |

Pressed: `scale(0.985)` + `opacity 0.92` over 120 ms. Colour does not change on press.
Disabled is a colour change (`muted` fill, `mutedForeground` label), never an opacity fade —
and stays focusable, announcing as unavailable.

## 6. Back button

38×38, `tennisRadii.control`, `card` fill, 1.5 `border`, glyph `‹` at 22 `body` in `heroOnLight`.
Hit area padded to 44. Margin below: 26 on Sign up / Log in, 22 on Consent / Identity / Zones.

## 7. Step progress bar

Row of three, `gap: 6`, each `flex: 1`, height 4, radius 2.
Filled `heroGreen`, empty `secondary`. Then 20 of space, then the `eyebrow`.

## 8. Art

Copy `handoff/assets/*` → `apps/mobile/assets/onboarding/`.

| File                    | Used by               |
| ----------------------- | --------------------- |
| `mid-lines-court.png`   | Welcome 5a            |
| `mid-lines-cut.png`     | Welcome 5c            |
| `hero-balls-net.png`    | Welcome 2a            |
| `hero-racket-cream.png` | Done 2e               |
| `hero-court.png`        | Done 2f               |
| `rb-icon-lime.png`      | mark on dark grounds  |
| `rb-icon-dark.png`      | mark on light grounds |

All art `resizeMode: "cover"`. Scrims are `expo-linear-gradient`.
Where a spec asks for a soft top edge, `MaskedView` with a vertical gradient mask is ideal;
a `LinearGradient` overlay in the ground colour is visually equivalent at these opacities
and is the acceptable substitute.
