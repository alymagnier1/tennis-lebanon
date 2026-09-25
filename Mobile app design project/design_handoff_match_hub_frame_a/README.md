# Handoff: Match Hub — host view with one pending join request (frame A)

## Overview

The **Match hub** is the screen a RacketBound player sees after opening one of their own
matches. This handoff covers one specific state: **the host is viewing a published,
still-recruiting singles match, and exactly one person has asked to join.**

RacketBound is an adult tennis matchmaking app for Lebanon (React Native / Expo,
English + Arabic RTL + French). The product exists to produce one outcome:

    compatible player → agreed time → accepted court booking → played match

For this screen that reduces to a single job. **If someone has asked to join, the
host's only job is to answer them.** Everything in the design serves that: the
requester occupies the open roster slot, the decision row sits immediately under the
match card, and **Approve is the only filled button anywhere on the screen.**

The screen it replaces had "Invite players" as a full-width primary inside the match
card while Approve sat below two 88px club photo cards — the host had to scroll past a
gallery to answer a person who was waiting. This design inverts that.

## About the design files

`RacketBound Match Hub.dc.html` in this bundle is a **design reference written in
HTML** — a prototype that shows intended look, spacing and hierarchy. It is **not
production code and should not be ported, transpiled, or copied into the app.**

The task is to **recreate this design in the existing React Native codebase**
(`apps/mobile`), using its established patterns: `StyleSheet.create`, the
`tennis-tokens.ts` theme, `tennisFontFamily` from `useTennisFonts.ts`, the existing
`FigmaButtons` / `SelectionCards` primitives, and `react-i18next` for every string.
Concretely: HTML `<div style="display:flex">` maps to `<View>`, text nodes must be
wrapped in `<Text>`, `ion-icon` maps to the icon set the app already uses, and the
`box-shadow` on the phone frame is presentation chrome for the mock — not part of the
screen.

The bundled file contains several turns of exploration. **Frame A is the one being
handed off** — the artboard with badge **6A**, id `#6a`, and
`data-screen-label="A · Host, 1 request"`. Ignore turns 3a, 4a and 5a; they are
earlier directions kept for history, and 5a in particular uses a display font
(Archivo) that is **not** part of this handoff.

## Fidelity

**High-fidelity.** Colours, type sizes, spacing, and radii are final and are stated
exactly below. Recreate the UI to match. Two caveats:

- The frame is drawn at iPhone 15 logical size (393×852). Values in this document are
  density-independent points, i.e. React Native units.
- The content runs roughly 30pt past 852. This is intended: the last club row and the
  invite link finish just below the fold. The screen scrolls.

## Screens / views

### Match hub — host, one pending join request

**Purpose.** The host answers Sara's request to join. Secondary: check who else was
invited and what they said, see which clubs the match is bound to, and invite someone
else if they would rather not approve Sara.

**Layout.** A single vertical scroll column.
Screen horizontal padding **22**. Sections are separated by **18** of vertical gap;
within a section the label sits **6** above its card, and rows inside a card are
divided by 1px rules rather than gaps.

Root: `background: #FAF9F6`, safe-area top, no tab bar (this is a pushed stack screen).

Vertical order, top to bottom — this order is the design:

| #   | Section                                  | Height |
| --- | ---------------------------------------- | ------ |
| 1   | Header: back chevron · title · Open pill | ~62    |
| 2   | Match card (the hero)                    | ~181   |
| 3   | `JOIN REQUESTS` — the decision           | ~180   |
| 4   | `INVITED` — 2 rows                       | ~145   |
| 5   | `PREFERRED CLUBS` — 2 rows               | ~117   |
| 6   | "Invite someone else" text link          | 44     |

Approve lands at roughly **400pt** — under half the frame — so a cold host can answer
without scrolling past anything.

---

#### 1 · Header

Row, `alignItems: center`, `gap: 12`, padding `10 / 22 / 12`.

- **Back**: 44×44 touch target, `marginLeft: -11` so the glyph optically aligns to the
  22pt gutter. Chevron 26, `#0D1C14`. Pops the stack.
- **Title**: `Outfit 800, 28, letterSpacing -0.9`, `#0D1C14`, `flex: 1`,
  single line with ellipsis. Text: **"Saturday 18:00"**.
  The title is the _match_, never the word "Match hub" — that was jargon in the old screen.
- **Status pill**: padding `6 / 12`, radius 20, background `#C8E63B`,
  `Inter 600, 12, letterSpacing 0.4`, `#0D1C14`. Text: **"Open"**.
  Not pressable. Colour is always paired with the word.

#### 2 · Match card (hero — keep this idea)

Card: `#FFFFFF`, 1px `#E9EBE8`, radius **18**, padding **14**, internal `gap: 12`.

**Metadata chips** — row, `gap: 6`. Each: padding `6 / 12`, radius **20**,
background `#EFF3EE`, `Inter 500, 12`, `#3D4A42`.
Three chips: **Singles**, **Social**, **3.0–4.0**.
These are quiet grey-green, **not lime, and not pressable** — they are metadata, and
lime in this product means "this is the action".

**Roster row** — `flexDirection: row`, `alignItems: flex-start`, `gap: 8`.
Three columns: host (`flex: 1`), time (fixed **110**), requester (`flex: 1`).

_Host column_, centred, `gap: 8`:

- Avatar **72×72**, radius **16**, background `#0C382E`, initials
  `Outfit 800, 24`, `#C8E63B`. Content: "RN".
- Name `Outfit 500, 15 / 19`, `#0D1C14`: "Rami N."
- Caption `Inter 400, 12 / 15`, `#627068`, `marginTop: -6`: "Host"

_Time column_, width **110**, centred, `gap: 4`, `paddingTop: 10`:

- `Outfit 600, 17, letterSpacing -0.3`, `#0D1C14`, nowrap: "Sat 18:00"
- `Inter 400, 12`, `#627068`: "90 minutes"
- Text link in a 44-tall row: `Inter 500, 13`, `#0C382E`, underline in `#B8C4BC`,
  nowrap: **"Change time"**. (Shortened from "Change the time" so it holds one line —
  keep it short in translation, or let the column grow.)

_Requester column_, centred, `gap: 8`:

- Avatar **72×72**, radius **16**, background `#C4521A`, `Outfit 800, 24`, `#FFFFFF`: "SK"
- Name `Outfit 500, 15 / 19`, `#0D1C14`: "Sara K."
- Caption `Inter 400, 12 / 15`, `#627068`, `marginTop: -6`: **"Wants to join"**

**The requester occupies the slot.** In the old screen an open seat was a dashed "?"
that looked tappable and did nothing while the person who wanted it sat in a card far
below. Putting Sara in the slot makes the open spot and its answer the same object.

**Empty-slot variant** (needed for the recruiting state, and for the rule below):
72×72, radius 16, 1.5px **dashed** `#E9EBE8`, centred "?" `Outfit 600, 24`,
`#627068`; caption "Open spot".

> **Rule to implement:** only the first-in-queue requester may occupy a slot, and only
> when `pendingRequests <= openSpots`. With 2 requests for 1 seat, render the dashed
> "Open spot" instead — the card must never imply a queue position it cannot honour.

**Do not put Invite inside this card while a request exists.**

#### 3 · `JOIN REQUESTS` — host only

Section label: `Inter 600, 13, letterSpacing 1, uppercase`, `#627068`.

Card: `#FFFFFF`, 1px `#E9EBE8`, radius 18, padding **14**, `gap: 10`.

- **Person row** — `gap: 12`. Avatar **40×40 circle** (radius 20), `#C4521A`,
  `Outfit 800, 15`, `#FFFFFF`: "SK".
  Name `Outfit 500, 15 / 19`, `#0D1C14`: "Sara Khoury", followed by a 14px chevron
  `#627068`. **The name and chevron are one tappable target → her profile.** A host
  should never have to decide on a bare name.
  Meta `Inter 400, 12 / 16`, `#627068`: "3.5 · Achrafieh". No phone, no email, no
  exact address — ever.
- **Note** — `Inter 400 italic, 13 / 18`, `#3D4A42`, max 2 lines then ellipsis:
  "Happy to play social — free after 6."
  The note must stay visible at the decision point.
- **Actions** — row, `gap: 8`, both `flex: 1`, min height **48**, radius **14**:
  - **Approve**: background `#C8E63B`, `Outfit 600, 15`, `#0D1C14`.
    The only filled control on the screen.
  - **Decline**: transparent, 1.5px `#E9EBE8`, `Outfit 600, 15`, `#3D4A42`.
    Equal size to Approve because they are a matched pair at one decision point, but
    the weight difference makes the affirmative read as the default.

**Full-roster variant:** retitle the section **"Waitlist"**, disable Approve
(background `#EFF3EE`, label `#627068`, `accessibilityState: {disabled: true}` —
never an opacity fade), keep Decline live, and add an explanatory line stating that a
seat reopening makes the first person approvable automatically.

#### 4 · `INVITED` — host only

Never render this to anyone who is not the host. A decline is private between the
player and whoever invited them.

Card: `#FFFFFF`, 1px `#E9EBE8`, radius 18, `overflow: hidden`.
Rows: padding `10 / 14`, `gap: 12`, divided by a 1px `#F0F2F0` rule.

_Row 1 — waiting:_

- Avatar 40 circle, `#7C3AED`, `#FFFFFF`: "MH"
- Name `Outfit 500, 15 / 19`, `#0D1C14`: "Maya Hage"
- Status pill: padding `3 / 9`, radius 20, background `#EFF3EE`,
  `time-outline` icon 12 + `Inter 500, 11.5`, both `#3D4A42`: "Waiting to answer"
- **Withdraw** — text link, 44 tall, `Inter 500, 13`, `#B91C1C`

_Row 2 — declined:_

- Avatar 40 circle, background `#EFF3EE`, initials `#627068`: "KJ"
- Name in `#627068` (dimmed, the row is inert): "Karim Jabbour"
- Status pill: background `#FDECEC`, `close-outline` icon 12 + `Inter 500, 11.5`,
  both `#B91C1C`: "Declined"
- **No Withdraw.** There is nothing to withdraw from a no.

_Third state, not shown in this frame but required:_ **"On hold — match full"** —
neutral pill, background `#EFF3EE`, `pause-outline` + `#3D4A42`. The invite is
suspended and returns automatically if a seat reopens; say so in the copy.

The three states must stay distinguishable by **icon and colour together**, and
"Declined" must never look like "Waiting".

#### 5 · `PREFERRED CLUBS`

Presence is not optional — joining a match is consent to the host's clubs, so the
names are always visible. Weight is what changes: during recruiting this is a compact
name list, **not** a photo gallery.

Card: `#FFFFFF`, 1px `#E9EBE8`, radius 18, `overflow: hidden`.
Rows: padding `11 / 14`, min height **46**, `gap: 12`, 1px `#F0F2F0` divider.

Each row: club name `Outfit 500, 15 / 19`, `#0D1C14`, then an inline area in
`Inter 400, 13`, `#627068` — rendered as "CSC Beirut · Achrafieh" — with a 17px
chevron `#627068` at the end. Row → club detail.

Rows: **CSC Beirut · Achrafieh**, **AUB · Hamra**. One to three clubs.
No photos, no map, no street address.

#### 6 · Invite

`Inter/Outfit 500, 15`, `#0C382E`, underline `#B8C4BC`, centred, 44 tall:
**"Invite someone else"**.

A text link, not a button. Inviting is still possible but it is not this screen's job
while a person is waiting for an answer.

## Interactions and behaviour

| Target                         | Behaviour                                                                                                                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Back                           | Pop the stack                                                                                                                                                                                                                                       |
| Status pill                    | Not interactive                                                                                                                                                                                                                                     |
| Metadata chips                 | Not interactive                                                                                                                                                                                                                                     |
| Host / requester avatar + name | → that player's profile                                                                                                                                                                                                                             |
| "Change time"                  | → propose-time flow                                                                                                                                                                                                                                 |
| Request name + chevron         | → requester's profile                                                                                                                                                                                                                               |
| **Approve**                    | Confirm, then seat the player. On success the request row leaves, the requester's caption changes from "Wants to join" to nothing, the roster count increments, and any invite that was "Waiting" for the last seat flips to "On hold — match full" |
| **Decline**                    | Confirm (destructive tone). Row leaves; the slot reverts to dashed "Open spot"                                                                                                                                                                      |
| Withdraw                       | Confirm; row leaves the Invited list                                                                                                                                                                                                                |
| Club row                       | → club detail                                                                                                                                                                                                                                       |
| Invite someone else            | → invite flow                                                                                                                                                                                                                                       |

**Press feedback** for every control: `scale(0.985)` + `opacity 0.92` over ~120ms.
Colour does not change on press. No other animation on this screen; it is a decision
surface, not a showcase.

**Loading.** Approve and Decline are optimistic with rollback on failure. While a
mutation is in flight, disable both buttons in the affected row only and show a spinner
in place of the pressed label — never block the whole screen.

**Errors.** Inline, above the action row: `semantic.critical` fill / border / text,
radius 12, `Inter 500, 12.5 / 18`. Reuse the existing onboarding error block.
An approval that fails because the seat was taken in the meantime must say exactly
that and refresh the roster.

**Empty states.** With no requests, the `JOIN REQUESTS` section is **absent, not
empty** — that is frame B (recruiting), where the primary becomes a single lime
"Invite players" and the slot is dashed. Empty states elsewhere should teach: how to
get players (widen level, time, or area), never just "nothing here".

**Accessibility.** 44pt minimum on every target (already true of the text links, which
carry 44-tall rows). Label the status pills as text, not colour. Support dynamic type:
the 28pt title may wrap to two lines, chips wrap as a group, the roster columns must be
allowed to grow rather than clip. Disabled controls stay focusable and announce as
unavailable.

**RTL.** Every row is a flex row with `gap` and a flexible middle, so mirroring is a
direction flip with no left/right assumptions. Use `start`/`end`, never `left`/`right`.
Arabic strings run ~20% longer: "Waiting to answer" and "On hold — match full" are the
tight ones and may wrap to two lines inside their pill — that is acceptable; truncating
them is not.

**Copy.** Every string goes through `react-i18next` with an `en.json` and `ar.json`
entry. Nothing on this screen may be hardcoded.

## State management

Per-screen state, reading the existing match query:

```
match: { id, format: "singles", vibe: "social", levelRange, startsAt, durationMinutes,
         status: "open", hostId, preferredClubs[] }
roster: [{ userId, name, initials, avatarColor, isHost }]      // length 1 here
openSpots: capacity - roster.length                             // 1 here
requests: [{ id, user, note, createdAt }]                       // 1 here
invites:  [{ id, user, status: "waiting" | "declined" | "on_hold" }]
viewerIsHost: boolean
```

Derived:

- `slotOccupant = (requests.length > 0 && requests.length <= openSpots) ? requests[0].user : null`
- `sectionTitle = openSpots === 0 ? "Waitlist" : "Join requests"`
- `canApprove = openSpots > 0`
- `showHostSections = viewerIsHost` — gates sections 3 and 4 entirely

Transitions: **approve** → roster += 1, requests −= 1, waiting invites become
`on_hold` when `openSpots` hits 0; **decline** → requests −= 1;
**withdraw** → invites −= 1; **seat reopens** → the first `on_hold` invite returns to
`waiting` and `canApprove` becomes true again.

Server is the source of truth for all four; the client mutates optimistically and
refetches the match on settle.

## Design tokens

Bind to `apps/mobile/src/theme/tennis-tokens.ts`. No raw hex in a screen file — if a
value below has no token, add the token first.

**Colour**

| Role                           | Hex                             |
| ------------------------------ | ------------------------------- |
| Canvas                         | `#FAF9F6`                       |
| Card                           | `#FFFFFF`                       |
| Ink                            | `#0D1C14`                       |
| Ink, secondary                 | `#3D4A42`                       |
| Muted text                     | `#627068`                       |
| Border                         | `#E9EBE8`                       |
| Divider (inside a card)        | `#F0F2F0`                       |
| Primary forest                 | `#0C382E`                       |
| Lime CTA                       | `#C8E63B` on `#0D1C14`          |
| Quiet chip / neutral pill fill | `#EFF3EE`                       |
| Danger                         | `#B91C1C`                       |
| Critical pill fill             | `#FDECEC`                       |
| Underline rule (text links)    | `#B8C4BC`                       |
| Avatar — host                  | `#0C382E` w/ `#C8E63B` initials |
| Avatar — Sara                  | `#C4521A` w/ `#FFFFFF`          |
| Avatar — Maya                  | `#7C3AED` w/ `#FFFFFF`          |
| Avatar — declined              | `#EFF3EE` w/ `#627068`          |

**Spacing.** Screen padding 22. Between groups 18. Label → card 6. Inside a card
10–12. Card padding 14. Row padding 10–11 vertical, 14 horizontal.

**Radii.** Card 18 · button 14 · chip and pill 20 · vs-card avatar 16 ·
list avatar 20 (full circle at 40) · status pill 20.

**Type.** Outfit for names, titles and buttons; Inter for meta, labels and notes.

| Role                 | Spec                                    |
| -------------------- | --------------------------------------- |
| Screen title         | Outfit 800 · 28 · −0.9                  |
| Time (vs card)       | Outfit 600 · 17 · −0.3                  |
| Name                 | Outfit 500 · 15 / 19                    |
| Button label         | Outfit 600 · 15                         |
| Avatar initials (72) | Outfit 800 · 24                         |
| Avatar initials (40) | Outfit 800 · 15                         |
| Section label        | Inter 600 · 13 · +1 · uppercase         |
| Chip                 | Inter 500 · 12                          |
| Status pill          | Inter 500 · 11.5                        |
| Meta                 | Inter 400 · 12 / 16                     |
| Note                 | Inter 400 italic · 13 / 18              |
| Text link            | Inter 500 · 13 (15 for the invite link) |
| Status bar           | Inter 600 · 14                          |

**Shadow.** None on any in-screen element. The only shadow in the mock is the phone
frame's presentation drop shadow — do not implement it.

**Minimum sizes.** Touch target 44. Primary/secondary button height 48.
Club and list rows 46+.

## Assets

None. Every avatar is initials on a flat colour — no image loading on this screen.
Icons used, all from the app's existing icon set: `chevron-back`, `chevron-forward`,
`time-outline`, `close-outline`, plus `pause-outline` for the on-hold state.
No photos, no map tile, no illustration. Club photography lives on club detail.

## Deliberately left off this screen

Stated so their absence reads as a decision, not an oversight:

- **Match chat** — belongs below the fold or in the header overflow; it is not the
  blocked action while someone waits for an answer.
- **Cancel match, leave match, release court, extend listing, host notes,
  participants list** — all move behind the header overflow menu, each behind a
  confirmation. No destructive red button shares a screen with Approve.
- **A second "Invite players"** — the old screen had one in the match card and another
  inside More. There is now exactly one invite affordance, as a text link.
- **Club photos, map, address** — club detail, one tap from each row.
- **Segment tabs** (Overview / Vote / Chat / Book) — not introduced; this is one
  scrolling surface.
- **Any feed, payment, or reliability metric.** Reliability stays factual and private;
  there are no public "shame" numbers in this product.

## Files

| File                            | What it is                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RacketBound Match Hub.dc.html` | The design reference. **Frame A** = badge `6A`, id `#6a`, `data-screen-label="A · Host, 1 request"`, plus its annotation sheet beside it. Earlier turns (3a, 4a, 5a) are exploration — ignore them. |

Target files in `apps/mobile`, for orientation:
`app/(matches)/[id].tsx` (or the existing match-hub route), the components under
`src/components/match/`, `src/theme/tennis-tokens.ts`,
`src/hooks/useTennisFonts.ts`, and `packages/i18n/src/locales/{en,ar}.json`.

## Frames still to design

This handoff is frame A only. Three states follow the same skeleton and were specified
but not yet drawn: **B** host recruiting with no requests (dashed slot, no requests
section, one sticky lime "Invite players"), **C** visitor who can request (clubs above
the CTA, optional note field, sticky "Request to join", no invited pipeline), and
**D** visitor with a request pending (info banner, read-only clubs, no primary button,
"Cancel my request" as a danger text link).
