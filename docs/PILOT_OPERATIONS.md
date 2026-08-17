# Pilot Operations Guide

Operational runbook for local rehearsal, staging smoke tests, and partner-club onboarding before the Lebanon tennis pilot. Pair with `docs/FLOWS_AND_SCREENS.md`, `docs/LIFECYCLE.md`, and `docs/TESTING_SECURITY.md`.

## Local environment

```bash
pnpm db:reset          # migrations + seed (fictional data only)
pnpm dev:mobile        # Expo mobile app
pnpm dev:dashboard     # Next.js club + admin dashboard
```

All seeded accounts use password **`password`**. Never reuse these credentials outside local/staging.

## Seeded identities

| Email                                | Role              | Mobile use                       | Dashboard use                          |
| ------------------------------------ | ----------------- | -------------------------------- | -------------------------------------- |
| `player-a@tennis-lebanon.test`       | Player (host)     | Create/join matches, book courts | —                                      |
| `player-b@tennis-lebanon.test`       | Player            | Join, vote, confirm results      | —                                      |
| `club-staff@tennis-lebanon.test`     | Club staff        | —                                | Booking queue at **Pilot Tennis Club** |
| `club-admin@tennis-lebanon.test`     | Club admin        | —                                | Club settings, courts, hours           |
| `platform-admin@tennis-lebanon.test` | Platform operator | —                                | `/admin/reports`, `/admin/disputes`    |

Additional discover liquidity: `player-c` … `player-j@tennis-lebanon.test` (same password).

## Seeded clubs

| Club                     | Booking mode  | Notes                                       |
| ------------------------ | ------------- | ------------------------------------------- |
| **Pilot Tennis Club**    | In-app queue  | Default rehearsal club; staff account above |
| **WhatsApp Tennis Club** | External link | Tests pay-at-club / WhatsApp handoff copy   |

Zones: **Pilot North**, **Pilot Central**, **Pilot South** (placeholder geography — replace before public pilot).

## Five partner-club workflow rehearsals

Rehearse end-to-end on a fresh `pnpm db:reset` before inviting real clubs. Mark each row when passed on staging.

| #   | Workflow                         | Primary accounts                  | Success criteria                                                                                    |
| --- | -------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | **Join a public match** (Flow A) | Player B → open match by Player A | Join or request approved; time vote unanimous; hub shows next action                                |
| 2   | **Create and book** (Flow B)     | Player A hosts; Player B joins    | Match full → agreed time → booking requested → club accepts → status `confirmed`                    |
| 3   | **Club queue** (Flow C)          | Club staff                        | Staff sees request, accepts/rejects/alternative; booking events audit; players notified             |
| 4   | **Result and rating** (Flow D)   | Both players                      | Attendance prompt → result submit → confirm → completed history; provisional rating rules respected |
| 5   | **Safety escalation**            | Player A reports; platform admin  | Report in `/admin/reports`; dismiss or resolve with audit; no direct DB edits                       |

### Quick paths (seed shortcuts)

After reset, seed includes sample open matches and participants so Discover is not empty:

- Player A hosts an open singles match in Pilot Central (`d1111111-…`).
- Player B can join seeded matches without creating liquidity from scratch.

Use these for fast UI checks; still run workflows 1–5 on staging before pilot sign-off.

## Cancellation and reliability (pilot policy)

- **24-hour late-cancel window** before booked start (`docs/LIFECYCLE.md`, migration `029`).
- Creator cancel after **full** requires a reason; withdraw from **confirmed** match requires a reason.
- Attendance classes: `cancelled_in_time` vs `late_cancel` — no public shame score.

Rehearse: creator cancels a full match with reason; participant withdraws from confirmed booking inside/outside 24h.

## Court handoff funnel (pilot measurement)

v1 secures courts over WhatsApp, so the pilot has to separate two questions that
one completion number blends together:

| Half                   | What it proves                                   |
| ---------------------- | ------------------------------------------------ |
| discover → agreed time | The player side — the thing the pilot is testing |
| agreed time → played   | The court side — gated on clubs not yet signed   |

A healthy first half with the loss concentrated in the second is a **pass** for
the player side and the mandate for club partnerships. Migration `070` records
each reach-out in `match_court_requests` so the second half is visible.

Run against the pilot database (read-only; no personal data in any result):

```sql
-- Court conversion: how many matches that reached a time actually got a court.
select
  count(*) filter (where m.status in ('confirmed','in_progress','completed')) as got_court,
  count(*)                                                                    as reached_time,
  round(100.0 * count(*) filter (
    where m.status in ('confirmed','in_progress','completed')
  ) / nullif(count(*), 0), 1) as pct
from public.matches as m
where m.selected_time_option_id is not null;
```

```sql
-- How many clubs a match had to be taken to before a court was secured.
select clubs_tried, count(*) as matches
from (
  select match_id, count(distinct club_id) as clubs_tried
  from public.match_court_requests
  group by match_id
) as t
group by clubs_tried
order by clubs_tried;
```

```sql
-- Reach-outs that were never answered: the host left for WhatsApp and the app
-- never heard back. A rising share here means the prompt is being ignored.
select status, count(*)
from public.match_court_requests
group by status;
```

```sql
-- Silent clubs. Which venues get asked and never convert to a booking.
-- `bookings` has no club_id -- a booking reaches its club through `courts`.
with booked as (
  select mcr.id
  from public.match_court_requests as mcr
  where exists (
    select 1
    from public.bookings as b
    join public.courts as ct on ct.id = b.court_id
    where b.match_id = mcr.match_id
      and ct.club_id = mcr.club_id
      and b.status = 'accepted'
  )
)
select
  c.name,
  count(*)                                             as asked,
  count(booked.id)                                     as booked,
  round(100.0 * count(booked.id) / nullif(count(*), 0), 1) as pct
from public.match_court_requests as mcr
join public.clubs as c on c.id = mcr.club_id
left join booked on booked.id = mcr.id
where mcr.status = 'sent'
group by c.name
order by asked desc;
```

The last query is also the **club pitch**: it is a per-club count of booking
requests the pilot sent them before they ever joined the project.

## Platform operations (no SQL required)

| Situation       | Dashboard route   | Action                                                       |
| --------------- | ----------------- | ------------------------------------------------------------ |
| User report     | `/admin/reports`  | Review, dismiss, or resolve (audited)                        |
| Disputed result | `/admin/disputes` | Confirm (apply rating) or void                               |
| Booking stuck   | Club `/bookings`  | Staff accept/reject; check lifecycle jobs if reminders stale |

Platform admin role is enforced in the database; dashboard checks session + `platform_operators`.

## Critical mobile flows (regression checklist)

Automated registry: `PILOT_CRITICAL_FLOWS` in `@tennis-lebanon/domain`. Manually smoke in **English and Arabic** before release:

- Auth magic link → onboarding → discover (players + matches)
- Match create → hub → book → chat → result
- Matches tab (invites, active, completed)
- Profile availability, clubs directory, player report
- Settings locale switch (RTL for Arabic)

i18n key parity is enforced in CI (`packages/i18n` locale tests), including stale-placeholder detection and Arabic script coverage for critical-flow keys.

### Arabic RTL manual pass

Before pilot release, switch to **Arabic** in Settings and rehearse each `PILOT_CRITICAL_FLOWS` screen. Use **Settings → RTL layout check** (`/rtl-check`) to verify mirrored layout and `writingDirection`.

Checklist:

- [ ] Auth magic link and onboarding consent screens
- [ ] Discover (players + matches) with filters and empty states
- [ ] Match create wizard, hub, booking, chat, cancel/withdraw
- [ ] Matches tab (invites, active, completed)
- [ ] Profile availability editor
- [ ] Clubs directory and detail
- [ ] Player report flow
- [ ] Settings and policy links

Confirm primary actions remain visible at largest dynamic type setting (iOS/Android).

## Pre-pilot blockers (outside this doc)

- Replace placeholder zone names and club copy with real pilot geography
- Legal review of `docs/legal/*` and production support/deletion contact
- Staging promotion: `docs/STAGING_CHECKLIST.md` and `pnpm verify:pilot`
- Backup/restore drill: `docs/BACKUP_RESTORE.md` and `pnpm drill:backup` (local) or hosted quarterly drill
- TestFlight / Play internal build submission (≥1–2 weeks before go-live)
- Founder sign-off on five workflow rows above with real partner club staff

## Support and incidents

- **Pilot support:** designate a single ops inbox (not seeded). Do not log message bodies, phone numbers, or tokens in analytics.
- **Account deletion:** owner-initiated request path must be documented in production privacy notice before public pilot.
- **Escalation:** disputed results and open reports should clear within an agreed SLA (suggest 48h during pilot).
