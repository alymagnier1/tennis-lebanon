# Beirut landing page — conversion fix plan

**Date:** 2026-10-02. **Applies:** Claude Code (founder's decision). **Cursor:** do not edit `apps/landing/` or `apps/dashboard/public/beirut/` until the Phase 1 PR lands.
**Inputs:** [`audits/BEIRUT_LANDING_AUDIT_2026-10-02.md`](audits/BEIRUT_LANDING_AUDIT_2026-10-02.md), DECISIONS 2026-09-29 (_A Beirut prelaunch signup is a waitlist row, not an account_), and [`BEIRUT_WAITLIST_RELEASE.md`](BEIRUT_WAITLIST_RELEASE.md).

## Goal

Make `racketbound.com/beirut` convert the warm traffic it will get first: people the founder messages on WhatsApp, and the people they forward it to. Do it **without** changing the signup commitment (a finished form creates the waitlist row), the collection rules, or the analytics policy (click and drop-off analytics stay off).

## Assumptions

- The page source is `apps/landing/page-template.html`. `python apps/landing/build.py` patches it by exact string and writes `apps/dashboard/public/beirut/index.html`. Commit both, and never run Prettier on either (they are in `.prettierignore`).
- English only for now. No database change in Phases 1–2.
- No paid ads until the soft launch in Phase 2 has a result.
- Copy rules:
  - don't imply automatic matching;
  - no absolutes ("no more…");
  - app access is described as it really rolls out: by invitation, Android first;
  - club names and counts appear only once verified.

## Decisions needed before Phase 1 (founder)

| #   | Decision                                                                                                                    | Recommendation                                                                                                                                                                                                                        | If no answer        |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| D0  | **Level descriptions:** use the app's wording on the page, or move both the page and the app to the page's ability wording? | **Use the app's wording on the page now.** It is one source, already in three languages, and used by every player who onboards. If the ability wording is preferred, change the app in its own PR (EN/FR/AR) and then match the page. | App's wording       |
| D3  | **Offer:** add "Founding players get in first, and we'll help set up your first match"?                                     | Yes, **only if** you will personally help up to 50 people set up a first match (the cold-start plan already expects it).                                                                                                              | Leave out           |
| D4  | **Trust cue:** a one-line founder note near the first button, and a contact line in the footer?                             | Yes. Write the line in your own words; the email is already public on the privacy notice.                                                                                                                                             | Footer contact only |
| D1  | **Campaign identifier** on signups                                                                                          | Later, before any paid ad (Phase 3).                                                                                                                                                                                                  | Not now             |
| D2  | **Contact-first signup**                                                                                                    | Only if people say they quit at step 2 (Phase 3).                                                                                                                                                                                     | Not now             |

**Founder's answers (2026-10-02):**

- **D0:** use the app's wording on the page.
- **D3:** yes, add the offer line. The founder commits to helping founding players set up a first match.
- **D4:** yes, add both the founder line (copy deck §9 draft) and the footer contact. The founder can reword the line before or after it ships.
- **D1 and D2:** not now.

Phase 1 therefore includes items 1.9 and 1.10.

## Phase 1 — page fixes and copy (one PR, Claude Code)

Each item gives what changes, where, and how it is checked. The source is `apps/landing/page-template.html` unless stated.

| #    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Where                                                                                                   | Accepted when                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1  | **Hero art clear of the copy on phones.** In the `max-width:760px` rules, raise `.hero-body` bottom padding and/or lower `.hero-art` (height or `object-position`) so the art's top sits below the reassurance line. Re-tune the `max-width:360px` rule the same way.                                                                                                                                                                                                                                   | template `<style>`                                                                                      | At 320, 360, 375, 390, 414 and 430 px: art top ≥ reassurance-line bottom + 16 px; the line measures ≥ 4.5:1; the button is not overlapped. |
| 1.2  | **Level descriptions** per D0 (copy deck §2).                                                                                                                                                                                                                                                                                                                                                                                                                                                           | step 2 `.level` labels                                                                                  | The five strings equal `onboarding.tennis.bands` in `packages/i18n/src/locales/en.json`, enforced by the test in 1.13.                     |
| 1.3  | **Promise line, steps, closing, sticky bar, FAQ:** copy deck §1 and §3–§6. Removes every "your group is ready".                                                                                                                                                                                                                                                                                                                                                                                         | hero `.promise`, `.steps`, `#closing`, `#sticky`, FAQ                                                   | `grep -c "group is ready"` on the built page = 0.                                                                                          |
| 1.4  | **Platform note** in the reassurance line (copy deck §1).                                                                                                                                                                                                                                                                                                                                                                                                                                               | hero `.micro`                                                                                           | Visible above the fold at 375 px.                                                                                                          |
| 1.5  | **Title, description, link preview:** copy deck §7. Change `og:url` to the canonical `https://racketbound.com/beirut` (no trailing slash, which 308-redirects).                                                                                                                                                                                                                                                                                                                                         | `<head>`; `og:url` is written by `apps/landing/build.py`                                                | The built `<head>` matches §7; `og:url` returns 200 without a redirect.                                                                    |
| 1.6  | **Success screen:** the WhatsApp invite becomes the main action (filled, full width, first), with the heading, body and prefilled message from copy deck §8.                                                                                                                                                                                                                                                                                                                                            | `#done` markup and `complete()` in the inline script                                                    | In live mode the invite button is the first focusable control after the title, and the prefilled text matches §8.                          |
| 1.7  | **Readability:** `.hint`, `.error`, `.form-foot` from 12 → 13 px; give `#privacy-open` and the in-form "Privacy notice" links a 44 px tap height.                                                                                                                                                                                                                                                                                                                                                       | template `<style>`                                                                                      | Measured: those links ≥ 44 px tall; no new wrapping at 320 px.                                                                             |
| 1.8  | **Error summary:** on an invalid submit, announce "N things need fixing" in a polite live region for that step. Focus still moves to the first invalid field.                                                                                                                                                                                                                                                                                                                                           | inline script + one live region per step                                                                | A screen reader announces the count once; the existing per-field messages are unchanged.                                                   |
| 1.9  | **D4 (if yes):** founder line under the reassurance line, and a footer contact line (copy deck §9).                                                                                                                                                                                                                                                                                                                                                                                                     | hero, footer                                                                                            | Renders at 320 px without pushing the button below the fold.                                                                               |
| 1.10 | **D3 (if yes):** the offer line (copy deck §9).                                                                                                                                                                                                                                                                                                                                                                                                                                                         | hero, under the promise                                                                                 | Same.                                                                                                                                      |
| 1.11 | **Step 2 hint and court field wording** (copy deck §4). The field stays free text in Phase 1, because changing what is stored is a data change.                                                                                                                                                                                                                                                                                                                                                         | `#step2`                                                                                                | Copy only; the payload is unchanged.                                                                                                       |
| 1.12 | Rebuild: `python apps/landing/build.py`, then `node --check apps/landing/syntax-check.js`.                                                                                                                                                                                                                                                                                                                                                                                                              | generated files                                                                                         | The built page diff contains only the intended changes.                                                                                    |
| 1.13 | **Test:** a Vitest check that reads the built `index.html` and `en.json` and asserts (a) the five level descriptions match the app (if D0 = app), (b) no "group is ready", (c) `og:url` has no trailing slash. Add the file to `include` in `apps/dashboard/vitest.prelaunch.config.ts` (today it lists only `route.test.ts`). The dashboard's `test` script is a placeholder, so CI runs neither file; wiring it to this config is a one-line follow-up, worth doing in the same PR if CI stays green. | `apps/dashboard/src/app/beirut/landing-copy.test.ts` (new); `apps/dashboard/vitest.prelaunch.config.ts` | It passes locally (and in CI if wired), and fails if the page and the app drift apart again.                                               |
| 1.14 | Record the copy decision in DECISIONS (D0, D3, D4 outcomes) and update the handover.                                                                                                                                                                                                                                                                                                                                                                                                                    | `docs/DECISIONS.md`, `docs/HANDOVER_2026-10-02.md`                                                      | In the same PR.                                                                                                                            |

**Verification before merge:**

- the build and syntax check (1.12) and the test (1.13);
- `pnpm --filter dashboard typecheck`, and `pnpm exec vitest run --config apps/dashboard/vitest.prelaunch.config.ts`;
- a browser pass at 320–1440 px: no horizontal scroll, keyboard through both steps, Escape, focus return;
- re-run the audit's contrast and target measurements.

**Never submit a real signup.** Test the success screen in preview mode over HTTP, where the page does not save.

**After merge:**

- the production deploy succeeds;
- `/beirut` returns 200 and `og:url` returns 200 without a redirect;
- the WhatsApp preview shows the new title. WhatsApp caches previews per URL for a while, so test once with `?v=2` appended.

## Phase 2 — founder outreach (no code)

1. List **10–15 people who usually organise games** and message each one personally (script A). Write down how many you messaged.
2. Two days later, send each non-joiner one follow-up question (script C), and copy their exact words into a note.
3. Run the **five-person test** from the audit (§7): five people sign up on their own phones while thinking aloud.
4. Keep a tally: date, messaged, joined (from `/admin/prelaunch`), and what non-joiners said. Joined ÷ messaged is your conversion rate, with no analytics.

| Date | Messaged | Joined | What stopped people (their words) |
| ---- | -------- | ------ | --------------------------------- |
|      |          |        |                                   |

## Phase 3 — only with evidence

- **D1, campaign identifier (before paid ads):**
  - a `source` field limited to an allowlist (`direct`, `wa-share`, `ad-a`, `ad-b`…), anything else stored as `other`;
  - a new migration (next free number) for the column;
  - accepted by `/api/prelaunch-signup` and shown in `/admin/prelaunch`;
  - one line in the privacy notice;
  - a DECISIONS entry that amends the 2026-09-29 analytics rule.
- **D2, contact-first (only if people quit at step 2):**
  - step 1 becomes "Request my invite" and creates the row with a confirmation;
  - step 2 becomes "Help us match you (optional)" and updates the same row;
  - needs a migration (level and availability nullable), an API change (create, then update by idempotency key), privacy notice wording, and a DECISIONS entry that supersedes part of 2026-09-29.
- **Signup counter:** only once there are 15 or more real entries. It needs a public, aggregate-only count (an RPC returning one number, cached) and appears beside the eyebrow ("23 of 50 Beirut players").
- **Structured court choices:** the four bookable clubs (once Phase 2.6 confirms they take non-member bookings), "A members-only club", "Other courts" plus a text box. This changes the stored shape, so it needs a migration and API change.

## Copy deck

Exact strings for Phase 1. "Now" is what the live page says on 2026-10-02.

### 1. Hero

| Element          | Now                                                                                                                                            | New                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Eyebrow          | Beirut · Join the first 50 players                                                                                                             | _(keep)_                                                                                                                                                                             |
| H1               | Find your next tennis partner in Beirut.                                                                                                       | _(keep)_                                                                                                                                                                             |
| Promise          | We're bringing together Beirut's first 50 tennis players. Tell us your level and when you play, and we'll invite you when your group is ready. | **Usual partner can't make it? RacketBound helps you find players around your level who are free when you are. Join Beirut's first 50 and we'll invite you to the app as it opens.** |
| Reassurance line | Free to join · 18+ · All levels welcome                                                                                                        | **Free to join · 18+ · All levels · Android first, iPhone later**                                                                                                                    |
| Button           | Get my invite →                                                                                                                                | _(keep)_                                                                                                                                                                             |

Alternatives for the promise line, if A runs long at 320 px:

- **B:** Tired of asking around for a game? Tell us your level and when you play. We'll invite you to the RacketBound app when there are enough players near your level.
- **C:** Find players around your level who are free when you are. Beirut's first 50 get invited to the app first.

### 2. Level descriptions (D0 = app)

| Level        | Now                              | New (from `onboarding.tennis.bands`) |
| ------------ | -------------------------------- | ------------------------------------ |
| Beginner     | I'm new to tennis                | I am new to tennis                   |
| Improving    | Learning to rally                | I am still learning to rally         |
| Intermediate | I can rally and play points      | I can rally and play points          |
| Advanced     | I place shots with control       | I play matches regularly             |
| Expert       | I sustain rallies under pressure | I train and compete                  |

### 3. Intro and steps

| Element         | Now                                                                                                                                                          | New                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intro, 2nd para | We're bringing together a first group in Beirut whose levels, courts and free time overlap, so the people you meet can realistically share a court with you. | **Asking around group chats for a game takes time. We're starting with Beirut so the players you find can realistically share a court with you.** |
| Step 01 title   | Tell us when you play.                                                                                                                                       | **Tell us about your game.**                                                                                                                      |
| Step 02 title   | Get invited when your group is ready.                                                                                                                        | **Get your app invite.**                                                                                                                          |
| Step 02 body    | We'll send access by WhatsApp or email as groups with similar levels and playing times take shape.                                                           | **We'll invite you by WhatsApp or email as enough players near your level and times join.**                                                       |

### 4. Form

| Element           | Now                                                      | New                                                                     |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Step 2 hint       | Your answers help us form groups that can play together. | **Your answers help us invite players whose levels and times overlap.** |
| Court label       | Usual court or Beirut area (optional)                    | **Where do you usually play? (optional)**                               |
| Court placeholder | e.g. your club, Hamra or Achrafieh                       | **e.g. the club or courts you use**                                     |
| Final note (live) | We'll contact you when your group is ready.              | **We'll invite you to the app as it opens for your level.**             |

### 5. Closing and sticky bar

| Element            | Now                                                                                        | New                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Closing body       | Be part of Beirut's first group. Free to join. We'll contact you when your group is ready. | **Be one of Beirut's first 50 players. Free to join. We'll invite you to the app as it opens.** |
| Sticky bar heading | Beirut's first 50 players                                                                  | _(keep)_                                                                                        |

### 6. FAQ

| Question                             | Now (relevant part)                                                                                                                                                 | New                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why start with 50 players in Beirut? | …If your group isn't ready yet, we'll keep you on the list for the next group.                                                                                      | …**If there aren't enough players near your level yet, you stay on the list and we'll invite you as soon as there are.**                          |
| What happens after I join?           | We'll use your preferred contact to send your Beirut invitation when the group is ready…                                                                            | **We'll use your chosen contact to invite you to the app when there are enough players near your level and times…** (rest unchanged)              |
| Can I join if I live outside Beirut? | Yes, if you can regularly come to Beirut to play. This first group is for matches in Beirut. If you only play elsewhere, please wait for a community closer to you. | **Yes, if you can regularly play in Beirut. If you mostly play elsewhere, join anyway and tell us where. It helps us decide where to open next.** |

### 7. Head

| Tag              | Now                                                                                                                                                  | New                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `<title>`        | RacketBound Beirut · Find your next tennis match                                                                                                     | **RacketBound Beirut · Find your next tennis partner**                                                                   |
| `description`    | Find tennis players around your level in Beirut, with courts close by and times that work for you. Free to join. Adults 18+, all levels welcome.     | **Find tennis players around your level in Beirut who are free when you are. Join the first 50. Free, 18+, all levels.** |
| `og:title`       | Find your next tennis partner in Beirut                                                                                                              | **Usual tennis partner can't make it?**                                                                                  |
| `og:description` | Players around your level, courts close by, and time to play. Get your invite to Beirut's first group. Free to join. Adults 18+, all levels welcome. | **Find players around your level in Beirut who are free when you are. Join the first 50: free, 18+, all levels.**        |
| `og:url`         | https://racketbound.com/beirut/                                                                                                                      | **https://racketbound.com/beirut**                                                                                       |
| `og:image`       | racketbound-og.jpg (balls and "Find your next tennis partner in Beirut")                                                                             | _(keep; the image text still fits)_                                                                                      |

### 8. Success screen (live mode)

| Element           | Now                                                                                                                                                         | New                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Title             | You're on the list, {name}.                                                                                                                                 | _(keep)_                                                                                                                                                                       |
| Body              | We'll send your Beirut invitation by {channel} when your group is ready. Your level and availability will help shape the first group.                       | **We'll invite you to the app by {channel} when there are enough players near your level and times.**                                                                          |
| Invite heading    | More familiar faces. More tennis.                                                                                                                           | **Know someone you play with?**                                                                                                                                                |
| Invite body       | Know someone who can play in Beirut? Invite them to help the community take shape.                                                                          | **The more players near your level who join, the sooner you'll get your invite.**                                                                                              |
| Button            | Invite a player on WhatsApp ↗ (secondary style, below the text)                                                                                             | **Invite on WhatsApp** (primary style, first)                                                                                                                                  |
| Prefilled message | I'm joining RacketBound's first tennis community in Beirut. Find players around your level and make time to play. Join here: https://racketbound.com/beirut | **I just joined RacketBound's first 50 in Beirut. It helps you find tennis players around your level who are free when you are. Join with me: https://racketbound.com/beirut** |

The invite body is true: invitations go out as enough players near a level join (FAQ "Why start with 50").

### 9. Optional lines (D3, D4)

- **D3 offer:** Founding players get in first, and we'll help set up your first match.
- **D4 founder line (draft; the founder must rewrite it in their own words and keep only what's true):** I'm Ali. I built RacketBound because finding someone at my level, free at the same hour, took more messages than the match.
- **D4 footer:** Questions? aly.moghnieh@gmail.com

### Localisation notes (for an AR/FR page later)

- **French runs 15–30% longer.** Check the promise line and the buttons at 320 px.
- **Arabic:**
  - set `dir="rtl"` and flip `→` to `←`;
  - keep the phone field `dir="ltr"`, with `+961` at the start in both directions;
  - wrap "18+" for bidi;
  - Outfit has no Arabic glyphs, so use the system Arabic font.
- **Idioms:** "asking around" and "can't make it" are idioms; give translators the literal meaning.

## WhatsApp scripts (founder)

Send from your own number, one person at a time, in whatever language you'd normally use with them. Edit freely; these are starting points, not templates to paste unchanged.

**A — to someone who organises games**

> Hey Karim, I'm launching RacketBound in Beirut. It's an app to find tennis players around your level who are free when you are. I'm starting with the first 50 players and would love you in early. It takes a minute: racketbound.com/beirut
> If you know people you play with, forward it to them too.

**B — short version, for someone you know less well**

> Hi Maya, it's Ali. I'm starting RacketBound, an app for finding tennis players in Beirut at your level. The first 50 players get invited first: racketbound.com/beirut

**C — follow-up, two days later, only to people who didn't join**

> No pressure at all. Quick question so I can improve it: what stopped you from joining?

**D — thank-you after someone joins**

> Thanks for joining! If there's someone you usually play with, send them the link too. The more players near your level, the sooner you'll get your invite.

Don't send C more than once, and don't follow up again after it.
