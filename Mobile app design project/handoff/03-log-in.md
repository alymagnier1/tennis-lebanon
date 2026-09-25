# 03 — Log in

**Design:** 1a · **File:** `app/(public)/sign-in.tsx`

Identical to `02-sign-up.md` with four differences:

1. One background mark only — the 300×300 circle at `right: -70`, `bottom: -40`,
   `heroGreen` `opacity: 0.05`. Drop the rotated rule.
2. Title "Welcome back"; subtitle "Log in with your email and password, or continue with Google."
3. No password hint. In its place "Forgot password?" — `paddingTop: 12`, `bodySemi` 13,
   `heroGreen`, hit area ≥44 → `/(public)/forgot-password`.
4. Primary "Log in"; divider "Sign in with"; footer "Don't have an account? Create one"
   → `/(public)/sign-up`.

Input, button, divider and Google specs unchanged. Back → `/(public)/welcome`, `marginBottom: 26`.

## Acceptance

- "Forgot password?" is a real 44-tall target despite the tight visual spacing.
- Magic-link and callback routing (`auth-routing.ts`) untouched.
