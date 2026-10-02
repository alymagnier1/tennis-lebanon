# Beirut landing page audit — 2026-10-02

**Page:** `https://racketbound.com/beirut` (from `apps/dashboard/public/beirut/index.html`, shipped in #43; #44 changed docs only, and the live HTML was unchanged throughout).
**Auditor:** Claude Code, at the founder's request, as a report for Cursor, which owns the page. Nothing on the page was changed.
**Scope:** messaging, wording, layout, UI/UX and accessibility. Checked at 320, 360, 375, 390, 414 and 1440 px. Signup steps 1 and 2 were opened with sample details; **nothing was submitted**.
**Methods (one skill each):** WCAG 2.1 AA review; Nielsen heuristics with 0–4 severity; StoryBrand SB7 and BrandScript; CRO quick diagnostic with objection/counter-objection hypotheses; Refactoring UI diagnostic; UX copy alternatives with localisation notes.

## Read this first

- **There is no conversion data yet.** On 2026-10-02 the waitlist held 1 entry and 3 logged attempts (aggregate counts only). Click and drop-off analytics are off by design. Nothing in this report is a measured conversion finding. The scores are rubric judgments.
- **It supersedes the earlier chat audit.** That version overstated two things, and both are corrected here:
  - "save after step 1" is a **product decision**, not a defect, and nothing shows it is the main loss;
  - a campaign tag attached to a signup **is** information about that person, so it must be a controlled, disclosed field.
- **Copy constraints that apply to every suggestion below:**
  - don't imply automatic matching;
  - don't promise absolutes ("no more …");
  - describe app access as it actually rolls out (by invitation, Android first);
  - show club names and counts only once verified.

## Priorities

| #     | Do                                                                                                                    | Why                                                                       | Effort                       |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| 1     | Stop the hero art overlapping the reassurance line on phones                                                          | WCAG 1.4.3 failure (≈3.0:1) and visible clash on every phone width tested | CSS                          |
| 1     | Use the app's exact level descriptions in step 2                                                                      | Players self-place differently here than in the app (Advanced, Expert)    | Copy                         |
| 2     | Rewrite the promise line: the "usual partner can't" hook plus honest app-access timing; replace "your group is ready" | Problem never named; "group" suggests a team or WhatsApp chat             | Copy                         |
| 2     | Say "Android first, iPhone later" before the signup, not only in the FAQ                                              | iPhone users otherwise learn it after joining                             | Copy                         |
| 3     | One genuine trust cue (founder line and/or a visible contact) and bigger small text (hints, errors ≥ 13–14 px)        | The number ask is high-trust; 12 px text is hard outdoors                 | Copy + CSS                   |
| 3     | Error summary announced on submit                                                                                     | Only the first error is read out                                          | Small JS                     |
| D1    | **Decide:** a controlled campaign identifier on signups before paid ads                                               | Without it you cannot compare ads; it needs disclosure                    | API + privacy notice         |
| D2    | **Decide:** contact-first signup (step 1 = "Request my invite", step 2 optional)                                      | Trades matching data for more contacts; adopt only on evidence (§7)       | API + likely a new migration |
| Later | Structured court choices with an "Other" box                                                                          | Aggregatable; shows who plays only at members-only clubs                  | Form + API                   |

## 1. Accessibility — WCAG 2.1 AA

**Summary:** 1 failure (major), 3 minor improvements, 0 critical. Measured from computed styles in the browser and, for text over the image, from screenshot pixels.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                          | Criterion                                            | Severity | Fix                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | On phones the hero art starts above the reassurance line ("Free to join · 18+ · All levels welcome", 13 px). Where the top ball sits behind it, contrast is **≈3.19:1 (390 px) and ≈3.00:1 (414 px)** median, down to **1.11:1** on highlights. At 320 px the art's top (513 px) is above the line's bottom (563 px), and at 414 px the ball reaches the button. | 1.4.3 Contrast                                       | 🟡 Major | Keep the art below the copy: raise `.hero-body` bottom padding on ≤760 px or anchor the art lower (`object-position`/`height`). Then re-check at 320–430 px. On plain green the line is 8.69:1. |
| A2  | When step 1 or 2 is submitted with several errors, focus moves to the first invalid field and only its error is read out. The other errors are announced only when reached.                                                                                                                                                                                      | 3.3.1 (passes) — usability                           | 🟢 Minor | Announce a one-line summary ("3 things need fixing") in a live region, as `#submit-error` already does for server errors.                                                                       |
| A3  | Small text: eyebrows, hints, error messages, form notes, footer and the sticky-bar sub-line are 12 px. All pass contrast (≥ 5.08:1), but error and hint text at 12 px is hard to read on a phone outdoors.                                                                                                                                                       | 1.4.4 (passes) — readability                         | 🟢 Minor | Hints and errors 13–14 px; leave eyebrows.                                                                                                                                                      |
| A4  | "Privacy" footer link is 42 × 44 px; the in-form "Privacy notice" link is 180 × 34 px.                                                                                                                                                                                                                                                                           | 2.5.8 AA (passes, ≥ 24 px); 2.5.5 AAA (44 px) misses | 🟢 Minor | Pad to 44 px.                                                                                                                                                                                   |

**Passed (measured):**

- **Contrast:** every text pair passes. The lowest are body and hint grey `#5C6A62` on `#FAF9F6` at 5.4:1 and on the availability header at 5.08:1. Error red is 6.15:1. The lime "in Beirut." is 9.15:1, and lime buttons 12.43:1.
- **Non-text contrast:** input and level-option borders are 3.05:1. Selected choices are 12.31:1. The availability grid's outer border is 1.36:1, but it is decorative; the checkboxes inside are native.
- **Reflow:** no horizontal scroll at 320 px.
- **Focus and keyboard:**
  - the dialog moves focus to the first field, traps it, closes on Escape, and returns focus to the button that opened it;
  - a visible focus ring (green on light, lime on dark);
  - a skip link;
  - FAQ items are native `<details>`, so they work by keyboard.
- **Structure:** `lang="en"`, landmarks (header, nav, main, footer), and a logical heading order (h1 → h2 → h3). Headings with `<br>` read with spaces (`innerText`).
- **Images and motion:** the hero art is decorative (`alt=""`, `aria-hidden`); the SVG logo is hidden next to visible text; `prefers-reduced-motion` is respected.
- **Forms:** every input has a label, radios sit in `fieldset`/`legend`, and errors are tied to fields with `aria-describedby` and `aria-invalid`.

**Not tested (do before the campaign):** VoiceOver (iPhone) and TalkBack (Android) read-through of both steps; desktop at 200% browser zoom; any Arabic or French version.

## 2. Usability — heuristics with severity (0–4)

| #   | Heuristic            | Finding                                                                                                                                                                                                                                                                                                 | Sev   |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| U1  | Consistency (4)      | Step 2 level descriptions differ from the app's onboarding: Improving "Learning to rally" vs "I am still learning to rally"; **Advanced "I place shots with control" vs "I play matches regularly"**; **Expert "I sustain rallies under pressure" vs "I train and compete"**. The labels already match. | **3** |
| U2  | Match real world (2) | "Your group is ready" (×5) reads as a fixed team or a WhatsApp group, and "app" never appears in the first screen. Visitors are requesting access to an app.                                                                                                                                            | 2     |
| U3  | Aesthetic (8)        | Hero art collides with the reassurance line on phones (see A1).                                                                                                                                                                                                                                         | 2     |
| U4  | Visibility (1)       | Platform availability ("Android testing is underway") appears only in the FAQ. An iPhone user can join without knowing.                                                                                                                                                                                 | 2     |
| U5  | Recognition (6)      | "Usual court or Beirut area" is free text with neighbourhood examples. Typing is slower than tapping, and the answers are hard to aggregate.                                                                                                                                                            | 1     |
| U6  | Consistency (4)      | `<title>` says "Find your next tennis **match**"; the H1 and OG title say "partner". `og:url` ends in `/beirut/`, which 308-redirects.                                                                                                                                                                  | 1     |
| U7  | Help (10)            | FAQ "outside Beirut" ends "please wait for a community closer to you", which turns away someone who might travel or be useful later.                                                                                                                                                                    | 1     |
| U8  | Minimalism (8)       | The intro's two paragraphs make the same point.                                                                                                                                                                                                                                                         | 1     |
| U9  | Help (10)            | No visible contact on the page; the only contact is on the privacy page.                                                                                                                                                                                                                                | 1     |

**Passes:**

- system status: "Sending…", a confirmation, and the WhatsApp share;
- errors explain the fix, including the rate-limit and "temporarily unavailable" cases;
- error prevention: Lebanese numbers are normalised, and an email or international number also works;
- user control: Back on step 2, close at any time;
- one primary action everywhere;
- the sticky bar on phones.

**Score: 7/10** (skill rubric). There is one severity-3 issue (U1), and the "does anything make me stop and think?" check fails on U1 and U2. Reaching 10 needs U1–U4 fixed; the rest are polish.

## 3. Messaging — StoryBrand

### BrandScript (current page, and what is missing)

| Element          | On the page now                                                                          | Proposal (honest)                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero             | Adults in Beirut who want a tennis partner ✓                                             | Keep. One desire: a game at your level, at a time that works.                                                                                                                     |
| External problem | Implied only ("More people to play with")                                                | Your usual partner can't make it, and you don't know who else is free at your level.                                                                                              |
| Internal problem | Missing                                                                                  | Asking around group chats and waiting for replies; games that end up mismatched.                                                                                                  |
| Philosophical    | Missing                                                                                  | Finding a game shouldn't take more effort than playing one.                                                                                                                       |
| Villain          | Missing                                                                                  | The "anyone free Thursday?" message.                                                                                                                                              |
| Guide: empathy   | Weak; the promise opens with "We're bringing together…" (brand first)                    | Open with the player's situation, not "We".                                                                                                                                       |
| Guide: authority | None on the page (privacy and "no account" reassure about data, not about who is asking) | Use only what is true: a founder name and line; verified bookable clubs once confirmed (`PILOT_50_PLAYER_LAUNCH.md` Phase 2.6); a signup count once it is real. Nothing invented. |
| Plan: process    | 3 steps ✓                                                                                | Keep; retitle (see §4).                                                                                                                                                           |
| Plan: agreement  | Free to join · No account · No password ✓                                                | Add "Remove yourself anytime" (the privacy notice already supports it).                                                                                                           |
| CTA              | "Get my invite" ×3, sticky; transitional "How it works" ✓                                | Keep.                                                                                                                                                                             |
| Failure stakes   | Missing                                                                                  | Light: "another week of asking around".                                                                                                                                           |
| Success          | "Find a player. Make a plan." (functional)                                               | A game at your level on the courts you already use.                                                                                                                               |

### One-liner (cocktail-party test)

> **RacketBound helps tennis players in Beirut find people around their level who are free at the same times, so arranging a game takes less chasing.**

This is accurate to the product: Discover shows players within ±1 level whose availability overlaps. It does not claim automatic matching.

**Score: 5/10.** Passes: 5-second clarity, a 3-step plan, one obvious CTA, and an H1 that works as a one-liner (+2 of 3). Fails: the customer is not the subject of the promise line, the internal problem is missing, there is no empathy plus authority, and there are no stakes. Reaching 10 needs the promise rewrite, one genuine authority cue, and a light failure/success line.

## 4. Copy — recommended wording with alternatives

Every option respects the constraints in _Read this first_.

**Promise line under the H1** (now: "We're bringing together Beirut's first 50 tennis players. Tell us your level and when you play, and we'll invite you when your group is ready.")

| Option            | Copy                                                                                                                                                                              | Tone                | Best for         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------- |
| **A (recommend)** | Usual partner can't make it? RacketBound helps you find players around your level who are free when you are. Join Beirut's first 50, and we'll invite you to the app as it opens. | Direct, problem-led | Ads and WhatsApp |
| B                 | Tired of asking around for a game? Tell us your level and when you play. We'll invite you to the RacketBound app when there are enough players near your level.                   | Empathetic          | Organic shares   |
| C                 | Find players around your level who are free when you are. Beirut's first 50 get invited to the app first.                                                                         | Shortest            | Small phones     |

**Replacing "group":**

| Now                                         | Use                                                     |
| ------------------------------------------- | ------------------------------------------------------- |
| Get invited when your group is ready.       | Get your app invite.                                    |
| …when groups with similar levels…           | …as enough players near your level join.                |
| We'll contact you when your group is ready. | We'll invite you to the app as it opens for your level. |
| Be part of Beirut's first group.            | Be one of Beirut's first 50 players.                    |

**Steps:** 01 "Tell us when you play." → **"Tell us about your game."** The body already covers level, where and when.

**Micro line under the CTA:** "Free to join · 18+ · All levels welcome" → **"Free to join · 18+ · All levels · Android first, iPhone soon"**. Alternatively, put the platform note in the step-1 hint.

**Level descriptions (step 2):** use the app's strings exactly, from `onboarding.tennis.bands` in `packages/i18n/src/locales/en.json`: "I am new to tennis" · "I am still learning to rally" · "I can rally and play points" · "I play matches regularly" · "I train and compete".

**FAQ, outside Beirut:** "Yes, if you can regularly play in Beirut. If you mostly play elsewhere, join anyway and tell us where; it helps us decide where to open next."

**Footer:** add "Questions? `aly.moghnieh@gmail.com`", using the same contact the privacy notice already publishes, or a dedicated address if one is set up.

**Trust cue (optional, founder's choice):** one line near the first CTA, in the founder's own words, e.g. "I'm Ali. I built RacketBound because finding someone at my level, free at the same hour, took more messages than the match." Only if true.

**Localisation notes (for AR/FR later):**

- **French runs 15–30% longer.** "Get my invite" → "Recevoir mon invitation". Test the H1 at 320 px, and keep buttons free to wrap.
- **Arabic:**
  - `dir="rtl"`, with the arrow `→` flipped to `←`;
  - keep phone input and numbers LTR (`dir="ltr"` on the field), with the `+961` prefix at the start of the field in both directions;
  - "18+" needs bidi isolation;
  - Outfit has no Arabic glyphs, so use the system Arabic font (brand guide §5).
- **Avoid idioms** ("chasing", "asking around") in strings meant for translation; give translators the literal meaning.

## 5. Visual — Refactoring UI diagnostic

| Check                        | Result                                                   |
| ---------------------------- | -------------------------------------------------------- |
| Hierarchy reads when blurred | ✓ The H1, then the lime CTA, dominate                    |
| Works in grayscale           | ✓ Hierarchy comes from size and weight; lime is emphasis |
| Enough white space           | ✓                                                        |
| Labels de-emphasised         | ✓ Eyebrows and hints are muted                           |
| Spacing on a scale           | ✗ Many one-off values (17, 23, 25, 27, 31, 38 px…)       |
| Text width constrained       | ✓ Promise at 35ch, step text at 33–46ch                  |
| Contrast                     | ✗ Only the A1 overlap                                    |
| Elevation                    | ✓ Dialog and sticky bar only                             |

**Score: 8/10.** Fixing A1 → 9; adopting a spacing scale → 10.

**Brand note:** lime appears on the headline highlight, the CTA and the balls, while `docs/BRAND_GUIDELINES.md` §4 allows one lime element per screen. Decide, and update the guide or the page.

## 6. Conversion — CRO diagnostic

| Question                               | Now                                         |
| -------------------------------------- | ------------------------------------------- |
| One action?                            | ✓ "Get my invite"                           |
| Researched why visitors don't convert? | ✗ Not possible yet (no traffic); see §7     |
| Objection / counter-objection table?   | Partly. Hypotheses below, not yet validated |
| Value proposition in 5 s?              | ✓ The H1                                    |
| Persuasion assets?                     | ✗ None yet (see BrandScript authority)      |
| Funnel mapped?                         | ✗ Analytics off; attribution undecided (D1) |
| Path free of UX blockers?              | ✗ A1 overlap; mismatched level descriptions |

**Score: 3/10, mostly because this is pre-launch.** The research and funnel rows can only pass with traffic.

**Objection hypotheses (validate in §7 before acting on them):**

| Objection (Big 5) | Likely thought                                     | Counter on the page now                  | Candidate counter                                       |
| ----------------- | -------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| Trust             | "Who wants my WhatsApp number?"                    | Privacy page; "no account / no password" | A named person or contact; "remove yourself anytime"    |
| Fit               | "Is anyone near my level? Will it work on iPhone?" | FAQ only                                 | Platform note near the CTA; accurate level descriptions |
| Timing            | "When do I actually get something?"                | "When your group is ready" (vague)       | "Invited to the app as it opens for your level"         |
| Effort            | "How long is this?"                                | "About a minute" ✓                       | Keep                                                    |
| Price             | —                                                  | "Free to join" ✓                         | Keep                                                    |

## 7. How to find the real conversion problem (no tracking change needed)

1. **Five-person test this week.** Five people at a club, or friends who play, each sign up on their own phone. Ask them to think aloud, and don't help. Tasks:
   - "You want a game next week; what is this page offering?"
   - "Join it."

   Then ask: "What almost stopped you?" and "What do you expect to happen next?"

2. **Soft launch with a known denominator.** Send the link on WhatsApp to a counted list (for example 40 people). Signups ÷ people messaged gives a conversion rate without analytics.
3. **One question to non-joiners:** "What stopped you?" Write down their exact words; they become the copy.
4. **Decision rules:**
   - several people stop **before opening the form** → fix the copy, trust and platform note (priorities 2–3);
   - several stop **at step 2** → consider D2 (contact-first), done explicitly;
   - before paid ads → decide D1, because ad traffic is colder than your network.

## Appendix — measurements

| Item                                         | Value                                                              |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Lowest text contrast (page, measured)        | 5.08:1 (`#5C6A62` on `#F0F3EE`); body grey 5.4:1                   |
| Reassurance line over the ball, 390 / 414 px | ≈3.19:1 / ≈3.00:1 median, 1.11:1 on highlights (screenshot pixels) |
| Reassurance line on plain green              | 8.69:1                                                             |
| Input / level borders                        | 3.05:1 (`#88928C`)                                                 |
| Horizontal scroll at 320 px                  | None                                                               |
| Hero at 320 px                               | Art top 513 px, reassurance line bottom 563 px, CTA bottom 472 px  |
| Targets under 44 px                          | "Privacy" 42×44; "Privacy notice" 180×34 (both ≥ 24 px AA)         |
| Hero image                                   | `racketbound-hero.webp`, 116 KB, preloaded, decorative             |
| Waitlist (2026-10-02)                        | 1 entry, 3 attempts logged (aggregate counts only)                 |
