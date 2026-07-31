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
