# Pilot Operations Guide

Operational runbook for local rehearsal, staging smoke tests, and club listing before the Lebanon tennis pilot. Cohort 1 has no partner clubs: venues are listed, players book on the club's own WhatsApp. Pair with `docs/FLOWS_AND_SCREENS.md`, `docs/LIFECYCLE.md`, and `docs/TESTING_SECURITY.md`.

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

| Club                     | Booking mode  | Notes                                                                                       |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------- |
| **Pilot Tennis Club**    | In-app queue  | Seed only. The in-app queue is **not** the cohort-1 model — kept so the path stays testable |
| **WhatsApp Tennis Club** | External link | Tests pay-at-club / WhatsApp handoff copy                                                   |

Zones: **Pilot North**, **Pilot Central**, **Pilot South**. These are permanent **local fixtures** — 31 test files and `seed.sql` reference them by id. Staging and production get a single `beirut` zone from `supabase/pilot/beirut-zones.sql`; see `docs/DECISIONS.md` 2026-08-19.

## Four workflow rehearsals

Rehearse end-to-end on a fresh `pnpm db:reset` before inviting players, then again on staging before sign-off.

No club takes part in any of these. Cohort 1 has **no partner clubs**: players find a venue in the directory, book on the club's own public WhatsApp, and record the court themselves. Nothing reaches a club dashboard, so there is no staff-queue rehearsal — the old "Club queue (Flow C)" walkthrough tested a path this pilot does not use, and the in-app booking queue is out of scope per the launch checklist.

| #   | Workflow                               | Primary accounts                  | Success criteria                                                                                                                                                                                  |
| --- | -------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Join a public match** (Flow A)       | Player B → open match by Player A | Join or request approved; time vote unanimous; hub shows next action                                                                                                                              |
| 2   | **Create and secure a court** (Flow B) | Player A hosts; Player B joins    | Match full → agreed time → "Book on WhatsApp" opens a prefilled message → court recorded via `confirm_external_court` → status `confirmed`. Only the host can confirm the court (migration `058`) |
| 3   | **Result and rating** (Flow D)         | Both players                      | Attendance prompt → result submit → confirm → completed history; provisional rating rules respected                                                                                               |
| 4   | **Safety escalation**                  | Player A reports; platform admin  | Report in `/admin/reports`; dismiss or resolve with audit; no direct DB edits                                                                                                                     |

Workflow 3 is the awkward one to reach by hand: a match only turns `in_progress` once its agreed hour has passed, the auto-confirm and grace windows are measured in days, and the rating itself is only visible in the database. Drive those from outside with `node scripts/rating-sandbox.mjs setup`, which refuses to run against anything but `127.0.0.1`.

What to record is not "it worked" but **where you hesitated**. Every pause over what to tap next, and every screen that left you unsure whether something had happened, is a Phase 0.4 fix — far cheaper to find now than with fifty strangers.

### Quick paths (seed shortcuts)

After reset, seed includes sample open matches and participants so Discover is not empty:

- Player A hosts an open singles match in Pilot Central (`d1111111-…`).
- Player B can join seeded matches without creating liquidity from scratch.

Use these for fast UI checks; still run workflows 1–4 on staging before pilot sign-off.

## Cancellation and reliability (pilot policy)

- **24-hour late-cancel window** before booked start (`docs/LIFECYCLE.md`, migration `029`).
- Creator cancel after **full** requires a reason; withdraw from **confirmed** match requires a reason.
- Attendance classes: `cancelled_in_time` vs `late_cancel` — no public shame score.

Rehearse: creator cancels a full match with reason; participant withdraws from confirmed booking inside/outside 24h.

## Pilot measurement

**OMTM: completed matches per active player per month.**
**Counter-metric: no-show + late-cancel rate** — without it, completions can be inflated by
pushing people into matches they abandon. Report the two together, always.

Not DAU, sessions or opens. For a weekly sport those measure the wrong thing, and optimising
them would justify building the social feed the PRD excludes.

Every query below is read-only and returns no personal data. All were executed against a live
database before being written here.

### Read the funnel in two halves

v1 secures courts over WhatsApp, so one completion number blends two different questions:

| Half                   | What it proves                                          |
| ---------------------- | ------------------------------------------------------- |
| discover → agreed time | The player side — the thing the pilot is testing        |
| agreed time → played   | The court side — WhatsApp, the club's reply, turning up |

A healthy first half with the loss concentrated in the second is a **pass** for the player side,
and points at the handoff rather than the product: an unanswered WhatsApp, a club with no free
court, or two people who agreed and never went. One blended number cannot tell those apart, and a
pilot that cannot tell them apart has to be run twice.

```sql
select
  count(*) filter (where m.selected_time_option_id is not null) as reached_agreed_time,
  count(*)                                                      as published_or_later,
  round(100.0 * count(*) filter (where m.selected_time_option_id is not null)
        / nullif(count(*), 0), 1) as pct_discover_to_agreed,
  count(*) filter (where m.status = 'completed')                as played,
  round(100.0 * count(*) filter (where m.status = 'completed')
        / nullif(count(*) filter (where m.selected_time_option_id is not null), 0), 1)
        as pct_agreed_to_played
from public.matches as m
where m.status <> 'draft';
```

### Activation — the A1 magic moment

**A1 = a named opponent accepted and a time is agreed, within 7 days of finishing onboarding.**
The first proof the network works. Not signup, not a profile, not browsing.

Cohort anchor is `onboarding_completed_at`, not `created_at` — someone who never finished
onboarding never entered the funnel. The A1 timestamp is the later of the last accepted join and
the last yes-vote on the selected time option; a fixed-timing match has no votes, so it correctly
falls back to the join.

```sql
with onboarded as (
  select p.id as user_id, p.onboarding_completed_at as joined_at
  from public.profiles as p
  where p.onboarding_completed_at is not null
),
a1 as (
  select
    mp.user_id,
    min(greatest(second_join.joined_at,
                 coalesce(last_yes.voted_at, second_join.joined_at))) as a1_at
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  join lateral (
    select max(x.joined_at) as joined_at
    from public.match_participants as x
    where x.match_id = m.id and x.status = 'accepted'
  ) as second_join on true
  left join lateral (
    select max(v.updated_at) as voted_at
    from public.match_time_votes as v
    where v.time_option_id = m.selected_time_option_id and v.vote = 'yes'
  ) as last_yes on true
  where mp.status = 'accepted'
    and m.selected_time_option_id is not null
    and (select count(*) from public.match_participants as c
         where c.match_id = m.id and c.status = 'accepted') >= 2
  group by mp.user_id
)
select
  date_trunc('week', o.joined_at)::date as cohort_week,
  count(*)                              as onboarded,
  count(a1.a1_at) filter (where a1.a1_at <= o.joined_at + interval '7 days') as reached_a1_7d,
  round(100.0 * count(a1.a1_at) filter (where a1.a1_at <= o.joined_at + interval '7 days')
        / nullif(count(*), 0), 1) as pct
from onboarded as o
left join a1 on a1.user_id = o.user_id
group by 1
order by 1;
```

```sql
-- Time to first completed match, by cohort week.
with onboarded as (
  select p.id as user_id, p.onboarding_completed_at as joined_at
  from public.profiles as p
  where p.onboarding_completed_at is not null
),
first_done as (
  select mp.user_id,
         min(coalesce(mr.confirmed_at, mr.resolved_at, m.updated_at)) as first_completed_at
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  left join public.match_results as mr on mr.match_id = m.id
  where mp.status = 'accepted' and m.status = 'completed'
  group by mp.user_id
)
select
  date_trunc('week', o.joined_at)::date as cohort_week,
  count(*)                              as onboarded,
  count(f.first_completed_at)           as ever_completed,
  round(percentile_cont(0.5) within group (
    order by extract(epoch from (f.first_completed_at - o.joined_at)) / 3600
  )::numeric, 1) as median_hours_to_first
from onboarded as o
left join first_done as f on f.user_id = o.user_id
group by 1
order by 1;
```

### Repeat play — the pilot's pass/fail

One match is a novelty. Two is a behaviour.

```sql
-- Second completed match within 30 days of the first.
with done as (
  select mp.user_id,
         coalesce(mr.confirmed_at, mr.resolved_at, m.updated_at) as completed_at
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  left join public.match_results as mr on mr.match_id = m.id
  where mp.status = 'accepted' and m.status = 'completed'
),
ranked as (
  select user_id, completed_at,
         row_number() over (partition by user_id order by completed_at) as n,
         min(completed_at) over (partition by user_id)                  as first_at
  from done
)
select
  count(distinct user_id) as players_with_1,
  count(distinct user_id) filter (
    where n = 2 and completed_at <= first_at + interval '30 days'
  ) as players_with_2_in_30d,
  round(100.0 * count(distinct user_id) filter (
    where n = 2 and completed_at <= first_at + interval '30 days'
  ) / nullif(count(distinct user_id), 0), 1) as pct
from ranked;
```

```sql
-- H7: repeat-opponent share. If this runs high, prioritise standing groups over
-- discovery ranking. Counts viewer -> opponent pairings, so one singles match
-- appears twice; do not read the count as a number of matches.
with pairs as (
  select m.id as match_id,
         mine.user_id   as viewer,
         theirs.user_id as opponent,
         coalesce(mr.confirmed_at, mr.resolved_at, m.updated_at) as completed_at
  from public.matches as m
  join public.match_participants as mine
    on mine.match_id = m.id and mine.status = 'accepted'
  join public.match_participants as theirs
    on theirs.match_id = m.id and theirs.status = 'accepted'
   and theirs.user_id <> mine.user_id
  left join public.match_results as mr on mr.match_id = m.id
  where m.status = 'completed'
)
select
  count(*)                                as viewer_opponent_pairings,
  count(*) filter (where prior.n > 0)     as with_prior_history,
  round(100.0 * count(*) filter (where prior.n > 0) / nullif(count(*), 0), 1) as pct_repeat
from pairs as p
cross join lateral (
  select count(*) as n from pairs as q
  where q.viewer = p.viewer and q.opponent = p.opponent and q.completed_at < p.completed_at
) as prior;
```

### Liquidity and coordination health

```sql
-- Fill rate and expiry rate. Below ~50% filled, the hard side stops hosting.
select
  count(*) as published,
  count(*) filter (
    where (select count(*) from public.match_participants mp
           where mp.match_id = m.id and mp.status = 'accepted')
          >= public.match_capacity_for_format(m.format)
  ) as reached_capacity,
  count(*) filter (where m.status = 'expired') as expired,
  round(100.0 * count(*) filter (
    where (select count(*) from public.match_participants mp
           where mp.match_id = m.id and mp.status = 'accepted')
          >= public.match_capacity_for_format(m.format)
  ) / nullif(count(*), 0), 1) as pct_filled,
  round(100.0 * count(*) filter (where m.status = 'expired')
        / nullif(count(*), 0), 1) as pct_expired
from public.matches as m
where m.status <> 'draft';
```

```sql
-- H3: completion by timing mode. Fixed is already the default
-- (resolveMatchHostDefaults), so a large flexible population here would be a
-- surprise worth investigating.
select m.timing_mode,
       count(*)                                      as matches,
       count(*) filter (where m.status = 'completed') as completed,
       round(100.0 * count(*) filter (where m.status = 'completed')
             / nullif(count(*), 0), 1) as pct_completed
from public.matches as m
where m.status <> 'draft'
group by m.timing_mode
order by matches desc;
```

```sql
-- H8: host vs joiner. If hosts retain materially worse, host tooling becomes the
-- roadmap. Role is per-match, so someone who both hosts and joins appears in
-- both rows -- these are not mutually exclusive cohorts.
select case when mp.is_creator then 'host' else 'joiner' end as role,
       count(distinct mp.user_id)                            as players,
       count(distinct mp.user_id) filter (where m.status = 'completed') as ever_completed,
       round(100.0 * count(distinct mp.user_id) filter (where m.status = 'completed')
             / nullif(count(distinct mp.user_id), 0), 1) as pct
from public.match_participants as mp
join public.matches as m on m.id = mp.match_id
where mp.status = 'accepted'
group by 1
order by 1;
```

### Latent intent — the "I'm free" ping and the liquidity signal

Read the first query before the other two. A low tap rate on the ping means one of two very
different things, and only the denominator separates them: players ignoring the prompt, or
players never being shown any demand to respond to.

```sql
-- Did the signal ever have anything to say? `is_empty` is the denominator for
-- everything below: a pilot where this is 90% empty is a liquidity problem, not a
-- design problem, and no amount of copy will fix it.
select
  count(*)                                                     as views,
  count(*) filter (where (props->>'is_empty')::boolean)         as empty_views,
  round(100.0 * count(*) filter (where (props->>'is_empty')::boolean)
        / nullif(count(*), 0), 1)                               as pct_empty,
  round(avg((props->>'player_count')::numeric), 1)              as avg_peak_players,
  max((props->>'player_count')::integer)                        as best_peak
from public.client_events
where event = 'liquidity_signal_viewed';
```

```sql
-- Which half converts, and whether a bigger number converts better. `chip` is the
-- "when are you free" row; `liquidity` is a tap on one of the busiest-week blocks.
-- A high `pings_into_an_empty_block` on `chip` is the good case: someone going
-- first, with nobody to respond to yet.
select coalesce(props->>'surface', 'unknown')                   as surface,
       count(*)                                                 as pings,
       round(avg((props->>'player_count')::numeric), 1)          as avg_players_on_offer,
       count(*) filter (where (props->>'player_count')::integer = 0)
                                                                as pings_into_an_empty_block
from public.client_events
where event = 'availability_ping_sent'
group by 1
order by pings desc;
```

```sql
-- The only question that matters: did a pinged block become a match the player
-- actually joined? A lower bound -- one-off windows are hard-deleted when a player
-- tidies their availability, so a ping that produced a match and was then removed
-- disappears from this. `availability_ping_sent` is the durable record of the tap,
-- but it stores day_part/day_offset relative to the tap, not the block's instant,
-- so it cannot be joined to a match time.
with pings as (
  select aw.user_id, aw.starts_at, aw.ends_at
  from public.availability_windows as aw
  where aw.is_recurring = false
)
select
  count(*) as pinged_blocks,
  count(*) filter (where exists (
    select 1
    from public.match_participants as mp
    join public.matches as m on m.id = mp.match_id
    join public.match_time_options as mto on mto.id = m.selected_time_option_id
    where mp.user_id = pings.user_id
      and mp.status = 'accepted'
      and mto.starts_at < pings.ends_at
      and mto.ends_at > pings.starts_at
  )) as blocks_that_became_a_match
from pings;
```

### Counter-metric — abandonment

Report beside the OMTM. A rising completed-match count with a rising abandonment rate is not
progress; it is the network's trust being spent.

```sql
select
  count(*)                                                    as attendance_rows,
  count(*) filter (where mp.attendance = 'attended')           as attended,
  count(*) filter (where mp.attendance = 'no_show')            as no_show,
  count(*) filter (where mp.attendance = 'late_cancel')        as late_cancel,
  round(100.0 * count(*) filter (where mp.attendance in ('no_show', 'late_cancel'))
        / nullif(count(*), 0), 1) as pct_abandoned
from public.match_participants as mp
join public.matches as m on m.id = mp.match_id
where mp.status = 'accepted'
  and m.status in ('completed', 'in_progress', 'cancelled', 'expired');
```

### Court handoff

Migration `070` records each reach-out in `match_court_requests`, which is what makes the second
half of the funnel visible at all.

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

### Reading these honestly

- **Cohort by signup week.** Blended averages hide whether the product is improving, and at pilot
  scale a handful of enthusiasts carry the mean for months. The activation queries above already
  group by `cohort_week`; add the same `date_trunc('week', p.onboarding_completed_at)` to any
  query you care about over time.
- **Cut liquidity per zone, never aggregated.** Networks are local. A healthy corridor and a dead
  one average into a lie.
- **`completed_at` is approximate.** There is no `matches.completed_at` column, so completion time
  is `coalesce(mr.confirmed_at, mr.resolved_at, m.updated_at)` — the same expression
  `list_my_completed_matches` uses, kept identical on purpose. The `m.updated_at` fallback is
  imprecise because any row update bumps it, so treat time-to-first-match as a trend, not a
  measurement. If precision starts to matter, add a real `completed_at`.
- **These are hypotheses until the pilot runs.** Nothing here has met a real user. Draw the line in
  the sand — a target, a date, and what you do if you miss — before results arrive, or every number
  gets rationalised after the fact.

## Platform operations (no SQL required)

| Situation       | Dashboard route   | Action                                                       |
| --------------- | ----------------- | ------------------------------------------------------------ |
| User report     | `/admin/reports`  | Review, dismiss, or resolve (audited)                        |
| Disputed result | `/admin/disputes` | Confirm (apply rating) or void                               |
| Booking stuck   | Club `/bookings`  | Staff accept/reject; check lifecycle jobs if reminders stale |

Platform admin role is enforced in the database. The dashboard checks the session, then calls the `viewer_is_platform_operator` RPC; access requires a `public.platform_roles` row for that user with role `support` or `admin` (migration `026`).

## Critical mobile flows (regression checklist)

Automated registry: `PILOT_CRITICAL_FLOWS` in `@tennis-lebanon/domain`. Manually smoke in **English, French and Arabic** — all three of `PILOT_LOCALES` — before release:

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
- Founder sign-off on the four workflow rehearsals above. No club staff take part: cohort 1 lists venues and players book on the club's own public WhatsApp (2026-08-19 decision)

## Support and incidents

- **Pilot support:** single ops inbox, not seeded. Cohort 1 owner is **Ali Moghnieh**, inbox `aly.magnier@gmail.com` — temporary, to be replaced before public release (see the 2026-08-27 decision). Do not log message bodies, phone numbers, or tokens in analytics.
- **Daily ops pass:** clear `/admin/reports` and `/admin/disputes`, then look for matches that reached an agreed time but never recorded a court. That last one has no queue and has to be looked for.
- **Account deletion:** owner-initiated request path must be documented in production privacy notice before public pilot.
- **Escalation:** open reports clear within **24h** (safety), disputed results within **48h**.
