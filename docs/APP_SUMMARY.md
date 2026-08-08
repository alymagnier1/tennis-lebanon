# Tennis Lebanon — App summary

One-page overview of the product. For scope and acceptance criteria see [`PRD.md`](PRD.md); for screens see [`FLOWS_AND_SCREENS.md`](FLOWS_AND_SCREENS.md).

---

## What it is

**Tennis Lebanon** is a mobile-first marketplace that helps recreational players in Lebanon find a compatible opponent, agree a time, book a court through a partner club, and play the match. A lightweight web dashboard lets club staff approve booking requests; platform tools support moderation and operations.

It is **matchmaking-first**, not a club management suite or a social network.

---

## Who it’s for

| Audience               | Need                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **Players**            | Find someone at the right level, time, and area; coordinate without endless WhatsApp |
| **Friend groups**      | One place to propose times, vote, and request a court                                |
| **Club staff**         | Extra court bookings without replacing their existing ops                            |
| **Platform operators** | Safe pilot in one geography with audit and moderation                                |

**Launch:** One dense Lebanese corridor, ~5–8 partner clubs, ~300 verified adult players. Geography is modeled as **zones** (areas), not street addresses.

---

## Core promise

Move from **“I want to play tennis”** to a **completed match**:

```text
compatible player → agreed time → accepted court booking → played match
```

**North-star metric:** completed matches per week (accepted booking, full roster, mutually confirmed result or admin resolution).

---

## How a match happens (player journey)

1. **Sign up** — Email magic link, policies, provisional skill, play intent, formats, preferred **areas**.
2. **Discover** — Open matches and compatible players filtered by zone, level, format, intent, and optional availability overlap.
3. **Create or join** — Host sets time and clubs; profile holds usual format, level, and Discover defaults. Joiners see **preferred clubs** before they commit.
4. **Agree time** — Participants vote on proposed slots until everyone accepts one.
5. **Book a court** — Host requests a court at a listed club; staff **accept**, **reject**, or **propose an alternative** on the dashboard.
6. **Play** — Match hub: chat, reminders, court details, next action.
7. **Close out** — Attendance, result confirmation (or dispute), simple rating update after enough rated matches.

Payments are **not** in the app in v1 — players pay at the club.

---

## Mobile app (player)

### Main tabs

| Tab            | Purpose                                    |
| -------------- | ------------------------------------------ |
| **Home**       | Next action, upcoming match, quick paths   |
| **Discover**   | Open matches + compatible players          |
| **+ (centre)** | Create a match                             |
| **Matches**    | Invites inbox + active matches             |
| **Profile**    | Bio, skill, settings that feed matchmaking |

### Profile settings that shape every match

| Setting            | What it controls                                          |
| ------------------ | --------------------------------------------------------- |
| **Where I play**   | Preferred areas + favourite clubs (pre-fill create flow)  |
| **Match defaults** | Format, intent, level range, Discover / approval defaults |
| **Availability**   | Weekly windows and one-off slots for discovery overlap    |

### Create match (today)

Short flow, not a long wizard:

1. Loading → optional **first-time intro** (once).
2. **When and where** — time, areas/clubs, Discover toggles, notes → **Publish** or **Invite**.
3. Optional **per-match overrides** (format, intent, level).

Entry also from **Challenge** on a player profile or Discover card (pre-filled for that player).

### Safety and privacy

- No exact home address or live location on profiles.
- Match chat only for current participants.
- Block and report flows; blocked users hidden from discovery.
- Provisional skill band until enough rated matches; no public “shame score.”

---

## Club dashboard (web)

For assigned club staff:

- Booking request queue (accept / reject / alternative).
- Court calendar, blocks, indicative pricing.
- Club admin: courts, hours, staff.

Mobile-friendly; not a full club ERP.

---

## Platform admin (web)

Reports, disputes, user/club operations, audit trail. No impersonation in v1.

---

## In scope for MVP

- Account + verified contact (email magic link)
- Player profile, zones, availability, discovery
- Singles and doubles matches (public, invite-only, private)
- Proposed times + voting
- Club directory + **manual** booking approval
- Match hub, participant chat, invites (share link)
- Attendance, mutual result confirmation, simple rating
- English, Arabic (RTL), French structure
- iOS and Android (Expo)

---

## Out of scope for v1

In-app payments, coaches, lessons, tournaments/leagues, social feed, equipment marketplace, ads, wearables, video/AI analysis, padel/other sports.

---

## Technology (summary)

| Layer     | Choice                                               |
| --------- | ---------------------------------------------------- |
| Mobile    | React Native, Expo, Expo Router, TypeScript          |
| Dashboard | Next.js (App Router)                                 |
| Backend   | Supabase (Auth, Postgres, RLS, Storage, Realtime)    |
| Monorepo  | pnpm workspaces, shared domain rules and Zod schemas |

Authorization is enforced in the **database** (Row Level Security), not only in the UI.

---

## Design and UX principles

- **One obvious next action** on every match and booking (find, join, vote, book, confirm, play).
- **Defaults in profile**, quick tweaks when creating a single match.
- **Venue clarity** — hosts name preferred clubs; joiners agree to a zone and club shortlist, not a vague “somewhere in Beirut.”
- **Empty states** suggest widening time, level, or area — not dead ends.
- **Reliability** is factual and explainable; no punitive public scores.

Create-flow design reference: [`FIGMA_CREATE_MATCH_FLOW.md`](FIGMA_CREATE_MATCH_FLOW.md) and [`figjam/README.md`](figjam/README.md).

---

## Further reading

| Document                                       | Use when you need…                              |
| ---------------------------------------------- | ----------------------------------------------- |
| [`PRD.md`](PRD.md)                             | Rules, epics, acceptance criteria               |
| [`FLOWS_AND_SCREENS.md`](FLOWS_AND_SCREENS.md) | Screen inventory and critical flows             |
| [`DISCOVERY.md`](DISCOVERY.md)                 | How players and matches are ranked and filtered |
| [`LIFECYCLE.md`](LIFECYCLE.md)                 | Match and booking state transitions             |
| [`DATABASE.md`](DATABASE.md)                   | Tables, RLS, migrations                         |
| [`ROADMAP.md`](ROADMAP.md)                     | Build order and milestones                      |
| [`DECISIONS.md`](DECISIONS.md)                 | Dated product/engineering decisions             |

---

_Last aligned with the mobile create flow and profile settings (Where I play, Match defaults) as implemented in the codebase._
