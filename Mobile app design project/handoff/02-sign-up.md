# 02 — Sign up

**Design:** 1a · **File:** `app/(public)/sign-up.tsx`
(+ `src/components/auth/AuthEmailPasswordFields.tsx`, `AuthGoogleSection.tsx`)

Form screens are deliberately quiet: `background` ground, `card` fields, one green action, no hero art.

## Layout

Root `background`, `overflow: hidden`, padding `insets.top+36 / 28 / insets.bottom+30`.

Two background marks, `heroGreen` at `opacity: 0.05`, both `pointerEvents: "none"`:

- circle 300×300, `borderWidth: 2`, `borderRadius: 150`, `right: -70`, `bottom: -40`
- rule 420×2, `left: -40`, `bottom: 120`, `rotate: -14deg`

## Stack

| Element        | Spec                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Back           | `00-tokens.md §6`, `marginBottom: 26` → `/(public)/welcome`                                                               |
| Title          | `screenTitle`, `heroOnLight`, `marginBottom: 6`                                                                           |
| Subtitle       | `bodyForm`, `mutedForeground`, `marginBottom: 26`                                                                         |
| Email label    | `fieldLabel`, `mutedForeground`, `marginBottom: 6`                                                                        |
| Email input    | see below, `marginBottom: 16`                                                                                             |
| Password label | `fieldLabel`, `marginBottom: 6`                                                                                           |
| Password input | `paddingRight: 70`, `marginBottom: 6`                                                                                     |
| Reveal         | absolute `right: 12`, centred, hit area ≥44, `bodySemi` 12.5, `heroGreen`, "Show" / "Hide"                                |
| Hint           | `fieldHint`; `mutedForeground` untouched, `semantic.critical.text` when invalid                                           |
| Spacer         | `flex: 1`, `minHeight: 24`                                                                                                |
| Primary        | `primary` variant, 54                                                                                                     |
| Divider        | 20 above / 14 below; two 1px `border` rules with the label between, `gap: 12`, `bodyMedium` 11.5, `mutedForeground`, +0.4 |
| Google         | `neutral` 50, `gap: 10`, 17×17 four-colour mark                                                                           |
| Footer         | centred, `paddingTop: 16`, `bodyMedium` 13, `heroGreen` → `/(public)/sign-in`                                             |

## Input

`card` fill, 1.5 `border`, `tennisRadii.md`, padding `15 / 16`, `body` 15, text `heroOnLight`,
placeholder `mutedForeground`.
Focus: border → `heroGreen`. No shadow, no fill change.
Error: border → `semantic.critical.border`, hint → `semantic.critical.text`.

## Copy

- Title "Create your account"
- Subtitle "Use email and a password, or continue with Google. We will ask for your name in the next step."
- Labels "Email" / "Password"; placeholders "you@example.com" / "At least 8 characters"
- Divider "Sign up with" · Google "Continue with Google"
- Footer "Already have an account? Log in"

## Acceptance

- Decorative marks sit behind content and never intercept touches.
- With the keyboard open the form scrolls; the primary button stays reachable and uncompressed.
- `auth-cooldown.ts` and `email-auth-error.ts` behaviour is unchanged; errors render in the
  hint slot using `semantic.critical`.
