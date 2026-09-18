# Onboarding visual guidelines (for Claude / design AI)

Use this file when designing or restyling **Welcome**, **Sign up**, **Log in**, **Check email**, and **Forgot password**. It defines direction and constraints, not a finished Figma file.

Product: **RacketBound** — adult racket matchmaking in Lebanon (tennis first, padel later). Not a social feed, not a federation app, not a generic fitness brand.

Source tokens live in `apps/mobile/src/theme/tennis-tokens.ts`. Prefer those hex values over inventing a new palette.

---

## 1. Chosen aesthetic

**Name:** Court dusk graphic (minimal sport illustration)

**What it is**

- Dark forest court green as the brand field
- Optic lime / chartreuse as the only loud accent (ball, primary CTA on dark)
- Soft off-white for lines, net tape, and text on dark
- Flat or lightly rendered **vector** motifs: net tape + mesh, tennis balls, optional faint court lines
- Bottom-weighted illustration with large empty upper space for copy and controls
- Subtle grain / felt texture allowed if it stays quiet; no glossy stock-photo look

**Reference mood (approved direction)**

- Dark green field
- White net band cutting diagonally across the lower third
- Dark mesh below the tape
- One to three lime tennis balls resting on the tape
- Lots of calm empty green above for headline + buttons

**Reject these directions even if they look “premium”**

- Blue + green court-corner posters (introduces a second primary that fights `#0C382E`)
- Cream canvas + red racket + pop-art halftone (wrong brand colour; carnival, not club)
- Retro mustard / halftone sports posters as the default system
- Literal photography of courts, rackets, or players as full-bleed backgrounds
- Learning-app purple gradients, glass cards, or dense social-icon rows

---

## 2. Screen jobs (do not decorate every screen the same)

| Screen                            | Job                            | Visual weight                                                 |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| **Welcome**                       | Sell the product in one breath | Full brand theater: dark court field + approved motif         |
| **Sign up / Log in**              | Finish auth in ~20 seconds     | Quiet work surface; light canvas; motif absent or ≤6% opacity |
| **Check email / Forgot password** | Explain next step              | Same quiet family as Sign up / Log in                         |
| **Onboarding after auth**         | Consent → identity → zones     | Existing light onboarding system; do not re-skin as dark hero |

Rule: Welcome is the only screen that “performs.” Forms must feel like tools.

---

## 3. Colour system (bind to app tokens)

### Core brand

| Role             | Token                      | Hex       | Use                                                      |
| ---------------- | -------------------------- | --------- | -------------------------------------------------------- |
| Court green      | `primary`                  | `#0C382E` | Welcome background, dark brand surfaces                  |
| Near-black green | `primaryDark` / `limeText` | `#0D1C14` | Text on lime; deep headings                              |
| Lime             | `lime`                     | `#C8E63B` | Balls, primary CTA on dark, highlight word               |
| On primary       | `onPrimary`                | `#FFFFFF` | Body text on dark (prefer slightly soft white if needed) |
| App canvas       | `background`               | `#FAF9F6` | Sign up / Log in / check-email backgrounds               |
| Card             | `card`                     | `#FFFFFF` | Inputs, sheets                                           |
| Muted text       | `mutedForeground`          | `#627068` | Hints, secondary labels                                  |
| Border           | `border`                   | `#E9EBE8` | Field borders                                            |
| Clay accent      | `accent`                   | `#C4521A` | Rare; not for auth CTAs                                  |
| Danger           | `danger`                   | `#B91C1C` | Errors only                                              |

### Illustration-only neutrals (ok if not tokenized yet)

| Role                  | Approx hex             | Use                                  |
| --------------------- | ---------------------- | ------------------------------------ |
| Net tape / cream line | `#F5F0E6`              | Net band, ball seam                  |
| Mesh / deep shadow    | `#0A1F18` or `#0D1C14` | Net grid, contact shadow under balls |

### Do not introduce as brand primaries

- Royal / court blue (`#1A47A5` etc.)
- Mustard poster yellow as the main CTA
- Brand red for primary buttons
- Pure social-purple gradients

---

## 4. Composition rules

1. **Negative space first.** Upper 55–70% of Welcome stays clear for logo, headline, short supporting line, then CTAs.
2. **Motif anchors the bottom.** Net / balls live in the lower third and may sit behind or just above the footer—never through the headline.
3. **One motif family.** Prefer net + balls. Do not also pile on rackets, players, trophies, and court maps.
4. **Diagonal is optional, not mandatory.** A gentle diagonal net is fine; do not force diagonal section breaks on every form screen.
5. **RTL-safe.** Motifs must not rely on left-weighted storytelling. Arabic mirrors layout; illustration should still read when flipped or centered.
6. **Keyboard.** Auth forms: keep actions in a stable stack; do not pin a heavy sticky footer that jumps when the keyboard opens.
7. **Contrast.** White/cream text on `#0C382E`; dark text on `#FAF9F6` and on `#C8E63B`. Never put muted grey text on lime or dark green.

---

## 5. Typography & UI chrome

- Headlines: bold geometric sans; large; tight leading; one lime accent word on Welcome is enough.
- Body: readable sans; secondary text at reduced opacity on dark, `mutedForeground` on light.
- Primary CTA on Welcome: lime fill + dark text.
- Secondary CTA on Welcome: ghost / outline on dark.
- Primary CTA on Sign up / Log in: brand primary (dark green) or existing Figma primary—not a second lime field unless hierarchy needs it.
- Google: secondary control under a separator (“Sign in with” / “Sign up with”). No Facebook / Apple unless product reopens that decision.
- Inputs: light fields, clear labels, 8+ character password, show/hide control. No “Remember me.”
- Display name is **not** on Sign up; it stays in identity onboarding.

---

## 6. Illustration craft

**Allowed**

- Vector / 3D-lite graphic balls with simple seam and soft contact shadow
- Flat net tape + dark mesh
- Very faint vertical court-grid or grain on dark green
- Consistent lighting (one direction)

**Forbidden**

- Full-bleed photography
- Busy collages or floating UI stickers on the hero
- Realistic sweaty-player stock shots
- Watermarks, fake UI chrome, or unreadably small decorative type in the art

**Asset guidance for implementers**

- Prefer one reusable bottom illustration (SVG or optimized PNG) for Welcome.
- Sign up / Log in: omit the illustration, or use a near-invisible crop of the same line language.
- Export for @1/@2/@3; keep safe area above the home indicator.

---

## 7. Copy tone (structure, not final strings)

- Welcome: short promise (find a match at the right level—not a feed).
- Sign up: create account; email + password; Google optional.
- Log in: welcome back; email + password; forgot password; Google optional.
- Cross-links between Sign up ↔ Log in.
- All user-facing strings go through i18n (`en` / `ar` / `fr`). Never hard-code final copy in components.

---

## 8. What to deliver when asked to “design onboarding”

Produce, in order:

1. **Screen map** — Welcome → Sign up / Log in → Check email / Forgot password → existing onboarding.
2. **Layout wire in words** — zones for logo, headline, fields, primary CTA, social separator, footer links, illustration safe area.
3. **Token mapping** — which token each surface/button/text uses.
4. **Do / don’t list** for that proposal against this file.
5. Optional: ASCII or simple frame sketches—not a competing blue/red brand system.

Do **not** invent a new colour story. Do **not** redesign post-auth onboarding in the same pass unless asked.

---

## 9. Quick checklist before accepting a design

- [ ] Welcome is dark court green; forms are light (or clearly quieter)
- [ ] Lime is accent, not wallpaper
- [ ] No photography as full background
- [ ] No blue/red/cream alternate brand system
- [ ] Motif stays bottom-weighted; headline area clear
- [ ] Google separator present; no extra social networks
- [ ] Password auth structure preserved (no magic-link primary)
- [ ] RTL and contrast considered
- [ ] Tokens map to `tennis-tokens.ts`

---

## 10. Relationship to product decisions

- Auth method: email+password + Google (`docs/DECISIONS.md`, 2026-09-12).
- Brand name: RacketBound; scheme/slug unchanged for deep links.
- This guideline governs **visual direction for auth/welcome only**. Match hub, Discover, and club dashboard keep their existing systems unless a later decision extends this language.
