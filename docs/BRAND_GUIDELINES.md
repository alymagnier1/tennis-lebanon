# RacketBound brand guidelines

The single reference for how RacketBound looks and sounds, on every surface a player or a club sees: the app, `racketbound.com`, the invite page, store listings, and anything shared on WhatsApp.

This file gathers what already exists in code and decisions. It does not invent a new brand. Where a rule is new, it is marked **Proposed** and should be confirmed by the founder before it is treated as settled.

Sources, in order of authority:

- Colours: [apps/mobile/src/theme/tennis-tokens.ts](../apps/mobile/src/theme/tennis-tokens.ts). If this file and the tokens disagree, the tokens win; fix this file.
- Fonts: [apps/mobile/src/hooks/useTennisFonts.ts](../apps/mobile/src/hooks/useTennisFonts.ts)
- Logo files: [apps/mobile/assets/brand/](../apps/mobile/assets/brand/), [apps/dashboard/public/brand/](../apps/dashboard/public/brand/)
- Name: `docs/DECISIONS.md`, 2026-09-09 — _App is RacketBound_
- Welcome and auth visuals in detail: [ONBOARDING_VISUAL_GUIDELINES.md](ONBOARDING_VISUAL_GUIDELINES.md)

---

## 1. What the brand is

**RacketBound turns "I want to play" into a match that actually happens.** Find a compatible player, agree a time, book a court, play.

- **For:** adult recreational players in Lebanon. Tennis first, padel later — which is why the name says _racket_, not _tennis_.
- **Not:** a social feed, a federation, an official ranking, a fitness brand, or a club-management system.
- **Feels like:** a well-run club at dusk. Calm, confident, practical. The ball is the only loud thing on court.

---

## 2. Name

| Do                                                   | Don't                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| **RacketBound** — one word, capital R, capital B     | Racket Bound, Racketbound, RACKETBOUND, RB (in copy)       |
| `racketbound.com` — lowercase is fine in a URL       | RacquetBound — the _racket_ spelling was chosen on purpose |
| "RacketBound" in all user-facing copy, all languages | "Tennis Lebanon" anywhere a user can see it                |

"Tennis Lebanon" is the legacy internal name. It survives only in places no user sees (the Expo slug `tennis-lebanon`, the deep-link scheme `tennislebanon://`, package names in the monorepo). Do not rename those. Their reasons are in the 2026-09-09 decision.

The name is not translated. Arabic and French copy write **RacketBound** in Latin letters.

---

## 3. Logo

### 3.1 The pieces

| Asset        | What it is                                           | File                                                                                       |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Mark**     | The "RB" monogram with the lime ball in the R's bowl | `apps/mobile/assets/brand/racketbound-mark.svg`                                            |
| **Lockup**   | Mark + "RacketBound" wordmark, side by side          | `apps/mobile/assets/brand/racketbound-lockup.svg` (also in `apps/dashboard/public/brand/`) |
| **App icon** | Cream mark on a court-green rounded square           | `apps/mobile/assets/brand/racketbound-icon.svg` / `.png`                                   |
| **Splash**   | Launch screen artwork                                | `apps/mobile/assets/brand/racketbound-splash.png`                                          |

The mark SVG strokes with `currentColor`, so it takes the colour of whatever text colour it sits in. The ball is always lime with a cream seam, whatever the stroke colour.

> **Pending:** a local, unreviewed `brand-refresh` branch replaces the icon, splash and lockup with raster versions and a darker splash green (`#054F3B`). None of it is merged. Until it is reviewed and merged, the files listed above are the logo. If it lands, update this section and §4 in the same PR.

### 3.2 Which one to use

- **Lockup** — anywhere the brand introduces itself: `racketbound.com`, the invite page, store screenshots, the top of an email.
- **Mark alone** — when the name is already on screen or space is tight: the app header, a favicon, a social avatar.
- **App icon** — only as the app icon, or where a store badge-style square is expected. Don't use it as a general logo.

### 3.3 Colour versions

| Background               | Letters                               | Ball             |
| ------------------------ | ------------------------------------- | ---------------- |
| Light (`#FAF9F6`, white) | Court green `#0C382E`                 | Lime, cream seam |
| Court green `#0C382E`    | Cream `#FAF9F6` or white              | Lime, cream seam |
| Photo or busy art        | Don't. Put it on a solid panel first. | —                |

Wordmark text on light backgrounds is near-black green `#0D1C14`, as in the lockup file.

### 3.4 Clear space and minimum size — **Proposed**

Not yet decided anywhere; these follow the mark's own geometry.

- **Clear space:** keep an empty margin around the mark or lockup at least as wide as **the ball's diameter**. Nothing — text, edges, other logos — inside it.
- **Minimum size:** mark at least **24 px** tall on screen; lockup at least **120 px** wide. Below that, use the app icon instead, because the ball seam disappears.

### 3.5 Don't

- Recolour the ball, drop it, or move it out of the R.
- Stretch, skew, rotate, outline, or add shadows or gradients.
- Put the lime ball on a lime background, or the green letters on a dark background.
- Rebuild the wordmark in another font — use the file.
- Add a tagline inside the lockup.

---

## 4. Colour

### 4.1 The brand palette

Two colours carry the brand. Everything else supports them.

| Role            | Name             | Hex       | Token                     | Use                                                                  |
| --------------- | ---------------- | --------- | ------------------------- | -------------------------------------------------------------------- |
| **Brand field** | Court green      | `#0C382E` | `primary`                 | Hero backgrounds, primary buttons on light, logo letters             |
| **The accent**  | Optic lime       | `#C8E63B` | `lime`                    | The ball, the one primary button on a dark field, one highlight word |
| Deep ink        | Near-black green | `#0D1C14` | `primaryDark`, `limeText` | Headings on light; all text on lime                                  |
| Canvas          | Soft off-white   | `#FAF9F6` | `background`              | Light page background                                                |
| Card            | White            | `#FFFFFF` | `card`                    | Cards, inputs, sheets                                                |
| Muted text      | Sage grey        | `#5C6A62` | `mutedForeground`         | Secondary text on light                                              |
| Border          | Mist             | `#E9EBE8` | `border`                  | Dividers, input borders                                              |

**The lime rule:** lime is the ball. Use it for one thing per screen — the main action on a dark field, or one highlighted word. It is never a background for a whole section, and never text on a light background.

### 4.2 Supporting colours (app UI only)

These exist for product states, not for brand expression. Don't use them on the website or in marketing.

- **Clay** `#C4521A` (`accent`) — rare; clay-court references.
- **Status tones** — positive, attention, critical, info (`tennisSemantic`). Each colour is always paired with an icon.
- **Skill-band chips** — Beginner through Competitive (`tennisSkillBands`).
- **WhatsApp green** — only on the WhatsApp hand-off button.
- **Danger** `#B91C1C` — errors only.

### 4.3 Dark mode

In the app's dark theme, primary buttons switch to lavender `#6D4FE0`, because court green is too dark to show up on a dark surface. **Lavender is a dark-mode UI colour, not a brand colour.** Don't use it on the website, store art, or anything representing the brand.

### 4.4 Colour pairs that pass (and one that never does)

| Text                 | On                  | Contrast (approx.) | OK?                          |
| -------------------- | ------------------- | ------------------ | ---------------------------- |
| White / cream        | Court green         | ~13:1              | Yes                          |
| Near-black `#0D1C14` | Lime                | ~12:1              | Yes                          |
| Lime                 | Court green         | ~9:1               | Yes — for a word or the ball |
| Sage `#5C6A62`       | Canvas `#FAF9F6`    | ~5:1               | Yes — body size              |
| Lime                 | White or canvas     | ~1.4:1             | **Never**                    |
| Grey text            | Lime or court green | —                  | **Never**                    |

### 4.5 Colours that are not RacketBound

Don't introduce these as a primary: royal or court blue, poster mustard, brand red, purple gradients.

The club dashboard's blue is the internal operator tool's palette, not the brand. Public pages served from the dashboard — `/`, `/invite`, `/legal/*` — use the app palette above, as the invite page already does.

---

## 5. Type

| Role          | Font       | Weights in use     | Where                               |
| ------------- | ---------- | ------------------ | ----------------------------------- |
| **Headings**  | **Outfit** | 800, 700, 600, 500 | Titles, hero headlines, big numbers |
| **Body & UI** | **Inter**  | 400, 500, 600      | Paragraphs, labels, buttons, inputs |

Both are free Google Fonts, so the website should load the same two.

- Headlines: Outfit ExtraBold or Bold, large, tight line height, slightly negative letter spacing.
- One highlighted word in lime is the maximum on a dark hero ("Find Your **Match.**").
- Body stays Inter Regular. Don't set paragraphs in Outfit.
- Arabic falls back to the system Arabic font. Never force Latin fonts on Arabic text, and always lay Arabic out right to left.
- Only these weights ship in the app, to keep it small. Adding a weight means adding its import on purpose.

---

## 6. Imagery

The approved style is **"court dusk"**: flat vector net tape and mesh with one to three lime balls, sitting at the bottom of a dark green field, with calm empty space above for words. Full rules in [ONBOARDING_VISUAL_GUIDELINES.md](ONBOARDING_VISUAL_GUIDELINES.md) §1 and §6.

- **Yes:** simple vector balls, net, faint court lines, subtle grain; bottom-weighted; one motif family at a time.
- **No:** full-bleed photos of courts, players or rackets; stock "sweaty athlete" shots; collages; pop-art halftone; floating UI stickers.
- The tennis doodle pattern (`assets/chat-doodles.webp`) belongs to the chat wallpaper. Don't use it as a hero.
- Anything illustrated must still read when the layout is mirrored for Arabic.

---

## 7. Voice

RacketBound talks like a good club organiser: short, warm, direct, and honest about what happens next.

### 7.1 Principles

1. **Say the next step.** Every message should leave the player knowing what to do. "Waiting for the club to confirm" beats "Pending".
2. **Plain over clever.** Short sentences, everyday words. No sports clichés, no hype.
3. **Honest about limits.** If we don't know, say so. Never promise a court the club hasn't confirmed.
4. **Never shame.** Reliability is factual and private. No public scores, no guilt copy.
5. **Not official.** We don't claim UTR, NTRP, or federation rankings. Levels are bands the player picks, then earns.
6. **Private by default.** Talk about areas, never addresses. Never suggest we share a phone number.

### 7.2 Words

| Say                        | Avoid                                |
| -------------------------- | ------------------------------------ |
| match, player, court, club | game session, athlete, venue booking |
| level, band                | ranking, rating (until it's earned)  |
| area                       | location, address                    |
| Ask the club on WhatsApp   | Book now (it isn't instant)          |
| Play                       | Compete, dominate, crush             |

### 7.3 Lines already in the product

Reuse these before writing new ones. They live in `packages/i18n/src/locales/en.json`, with Arabic and French versions.

- **Hero headline:** "Find Your Match. Play Today." (`welcome.headline1–3`)
- **Title:** "Find your next tennis match" (`welcome.title`)
- **Positioning:** "For adult players in Lebanon who want a match at the right level — not a feed." (from `welcome.description`)
- **Promise, one line — Proposed for web and store:** "Find a player at your level, agree a time, book a court, and play."

Every user-facing string goes through i18n in English, Arabic and French. That includes the website.

---

## 8. Where it shows up

| Surface                    | Treatment                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `racketbound.com` **root** | Like the Welcome screen: court-green field, lockup in cream, one headline, one promise line, lime **Get the app** button, quiet "Club staff" link to `/login`. No feature grid, no photos. |
| `/invite`                  | Light canvas, lockup, one clear invite message, primary **Open in the app**, secondary **Get the app**. No match details before sign-in.                                                   |
| **App Welcome**            | The only screen in the app that performs: dark field and the court-dusk motif.                                                                                                             |
| **App forms and screens**  | Quiet tools: light canvas, green primary buttons, lime only for skill chips and highlights.                                                                                                |
| **Store listing**          | App icon, lockup on court green in screenshots, the promise line, real app screens. No lavender, no photos of people.                                                                      |
| **WhatsApp share**         | The link preview title is the invite message; the brand shows through the page it opens.                                                                                                   |
| **Club dashboard**         | Internal tool. Its blue stays, but the login page and any page a player can reach use the app palette.                                                                                     |

---

## 9. Checklist before anything ships

- [x] Name written **RacketBound**; no "Tennis Lebanon" visible
- [ ] Logo file used as-is, correct colour version, clear space kept
- [ ] Court green is the field; lime is used for one thing only
- [x] No lime text on light backgrounds, no grey text on lime or green
- [x] No blue, red, mustard or lavender presented as the brand
- [ ] Headings in Outfit, body in Inter; Arabic in a proper Arabic font, right to left
- [ ] No full-bleed photos; illustration is court-dusk vector, bottom-weighted
- [ ] Copy says the next step, makes no ranking claims, shames no one, reveals no contact details
- [ ] Strings are in i18n for English, Arabic and French
