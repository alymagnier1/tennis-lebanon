# Discovery Design

Design for Milestone 2 (E2): availability management, open-match discovery, and compatible-player discovery.

This document resolves the main technical gap identified in the project review: **how discovery queries work** while respecting privacy, blocks, RLS, and pilot-scale performance.

## Goals

- Help a player find **open matches to join** and **compatible players to invite**.
- Filter by zone, approximate level, format, play intent, and (optionally) overlapping availability.
- Never expose another user's private calendar; only show coarse compatibility signals in list views.
- Exclude blocked, suspended, and ineligible users at the database layer.
- Stay usable on slow Lebanese mobile connections (P95 read under 2 seconds after warm-up).

## Non-goals (v1)

- Gender-based filtering (deferred — see [Open design items](#open-design-items-from-project-review)).
- Map-based “players near me” using live location.
- Full-text search across bios or notes.
- Federated or cross-city discovery beyond configured active zones.

## Surfaces

| Surface                | User intent                          | Primary data source                                                                    |
| ---------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| **Open matches**       | Join an existing public match        | `matches` + `match_time_options` + participant counts                                  |
| **Compatible players** | Invite someone or start coordination | `player_profiles` + `player_zones` + private `availability_windows` (server-side only) |

Both surfaces live on the **Discover** tab (`docs/FLOWS_AND_SCREENS.md`). Home may show a condensed subset of the same results.

## Public response contracts

### Open match card (list/detail before join)

Safe to return to any authenticated, eligible viewer:

- `match_id`, `format`, `intent`, `visibility`
- `status`, `requires_creator_approval`
- `min_skill`, `max_skill`
- `zone` names/slugs (from `match_zones`, not addresses)
- `proposed_times`: `{ id, starts_at, ends_at }[]` (non-withdrawn options only)
- `participant_summary`: count accepted, capacity (2 or 4), creator display name + avatar
- `compatibility_hints`: coarse flags only, e.g. `level_fit`, `zone_overlap`, `availability_overlap` (boolean)

Do **not** return: match notes for private matches, non-public participant PII beyond public card fields, invite tokens, internal ratings.

### Compatible player card (list)

Safe to return:

- `user_id`, `display_name`, `avatar_path`
- `skill_band`, `play_intent`, `prefers_singles`, `prefers_doubles`
- `zones`: ordered zone names/slugs
- `provisional_rating_label`: e.g. “Provisional” until `rated_match_count >= 5`
- `completed_match_count` (aggregate, public-safe)
- `compatibility_hints`: `level_fit`, `zone_overlap`, `availability_overlap`, `intent_fit`, `format_fit` (booleans)

Do **not** return: raw `availability_windows`, `internal_rating` numeric value, contact details, reliability scores, report/block history.

## Skill band ordering

Discovery treats skill bands as an ordered enum. Store rank in one place (domain + SQL helper):

```text
beginner (1) < improving (2) < intermediate (3) < advanced (4) < competitive (5)
```

**Open match eligibility:** viewer's band must satisfy `min_skill <= viewer.band <= max_skill`.

**Player compatibility (default):** viewer band within ±1 rank of candidate band. Widen to ±2 when empty-state expansion runs (see below).

Add a migration constraint:

```sql
check (skill_band_rank(min_skill) <= skill_band_rank(max_skill))
```

(`skill_band_rank` is a SQL function mirroring `packages/domain`.)

## Availability model

### User-owned windows (`availability_windows`)

Two shapes (already in schema):

1. **One-off:** `starts_at`, `ends_at` (UTC storage).
2. **Recurring:** `weekday`, `local_start`, `local_end`, `timezone`, optional `valid_from` / `valid_until`.

All overlap checks use **UTC instants** after expanding recurring rows into a evaluation horizon.

### Evaluation horizon

Default: **14 days** from `now()` in `Asia/Beirut`, converted to UTC bounds for queries.

Configurable via RPC parameter `p_horizon_days` (max 28 in v1 to cap cost).

### Overlap algorithm (server-side)

For viewer `V` and candidate `C` (player or match times):

1. Expand `V` windows and `C` windows (or match proposed slots) into sets of `[start, end)` intervals within the horizon.
2. Overlap exists if any pair intersects with duration **≥ 60 minutes** (minimum playable slot).

For **open matches**, compare viewer availability against **proposed time options**, not the creator's full calendar.

For **compatible players**, compare viewer availability against candidate availability entirely inside the RPC — never ship candidate windows to the client.

### Coarse hints for UI

List cards show booleans only, for example:

- “Available times overlap this week”
- “Plays in your areas”
- “Similar level”

Optional detail screen before invite: still no raw calendar export; may show **overlapping day-part labels** derived server-side, e.g. `weekday_evening`, `weekend_morning` (enum buckets, not timestamps).

## Eligibility and exclusion rules

Apply in SQL before sorting. A row is excluded if any condition holds:

| Rule                                                 | Applies to   |
| ---------------------------------------------------- | ------------ |
| Viewer or target `account_status != 'active'`        | both         |
| Target has incomplete onboarding                     | both         |
| Block exists in either direction (`user_blocks`)     | both         |
| Viewer already participant on match                  | open matches |
| Match `status != 'open'` or `visibility != 'public'` | open matches |
| Match at capacity                                    | open matches |
| All proposed times withdrawn or entirely in the past | open matches |
| No zone overlap (unless filter explicitly widened)   | both         |
| Level out of range (unless empty-state widening)     | both         |

**Suspension/deletion:** suspended users cannot appear in discovery and cannot search.

## Block handling in Milestone 2

Full report queue ships in Milestone 8, but **block exclusion must work in M2** so discovery is safe during dogfooding.

Minimum M2 slice:

- `user_blocks` RLS (already in migration): blocker manages own blocks.
- Discovery RPCs join against blocks in both directions.
- Block action from public player profile (no report form required yet).

## Query implementation

### Approach: Postgres RPC + RLS, not client-side filtering

Discovery is authorization-sensitive and join-heavy. Implement as **`security definer` RPCs** that:

1. Assert `auth.uid()` is an active, onboarded user.
2. Apply exclusion rules internally.
3. Return only public-safe projection types.
4. Log a coarse analytics event (no PII).

Do **not** expose generic table scans for `availability_windows` or `matches` to the mobile client for discovery.

### RPCs (Milestone 2 migration)

```sql
-- Returns paginated open match cards
discover_open_matches(
  p_zone_ids uuid[] default null,       -- null = viewer's player_zones
  p_format public.match_format default null,
  p_intent public.play_intent default null,
  p_horizon_days int default 14,
  p_limit int default 20,
  p_cursor_created_at timestamptz default null
) returns setof ...;

-- Returns paginated compatible player cards
discover_compatible_players(
  p_zone_ids uuid[] default null,
  p_format public.match_format default null,
  p_intent public.play_intent default null,
  p_require_availability_overlap boolean default true,
  p_horizon_days int default 14,
  p_level_window int default 1,         -- rank distance ±N
  p_limit int default 20,
  p_cursor_user_id uuid default null
) returns setof ...;
```

Supporting helpers (same migration or `packages/domain` tests mirrored in SQL):

- `skill_band_rank(band skill_band) returns int`
- `expand_availability(user_id uuid, range tstzrange) returns tstzmultirange` (or setof ranges)
- `is_blocked(a uuid, b uuid) returns boolean`
- `match_participant_count(match_id uuid) returns int`

### Sorting

**Open matches (default):**

1. Soonest relevant proposed time (asc)
2. Fewest spots remaining (asc) — urgency
3. `created_at` (desc)

**Compatible players (default):**

1. `availability_overlap` desc
2. Level distance asc
3. `completed_match_count` desc (light social proof)
4. `user_id` asc (stable tie-break)

### Pagination

Keyset pagination only (no offset). Limits: default 20, max 50 per request.

### Indexes (add in M2 migration)

Review after `EXPLAIN ANALYZE` on seed data; likely additions:

- `player_zones(zone_id, user_id)`
- `match_zones(zone_id, match_id)`
- `availability_windows(user_id)` partial on active recurring/one-off
- Existing `matches_discovery_idx` is a good start; consider partial index `where status = 'open' and visibility = 'public'`

## RLS policies (Milestone 2)

Add alongside RPCs:

| Table                               | Policy intent                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                          | Authenticated read of **active, onboarded** users' public fields via RPC only; direct `select` limited to own row (existing) |
| `player_profiles`                   | Same — no broad direct read; discovery via RPC                                                                               |
| `matches`                           | Participants + creator CRUD via later milestones; no anonymous broad read                                                    |
| `match_zones`, `match_time_options` | Readable only through discovery/detail RPCs for eligible viewers                                                             |
| `zones`                             | Keep `zones_read_active`                                                                                                     |

**Important:** Even with RPCs, keep RLS enabled. RPCs run as definer but should set `search_path = ''` and validate `auth.uid()`.

## Rate limiting

Discovery is an expensive read path. Enforce in the RPC:

| Limit                     | Value |
| ------------------------- | ----- |
| Calls per user per minute | 30    |
| Max `p_limit`             | 50    |
| Max `p_horizon_days`      | 28    |

Implementation v1: insert/check row in `discovery_search_log(user_id, searched_at)` with rolling window, or reuse `audit_events` with action `discovery_search` if volume is low.

On limit exceeded: return throttling error code; client shows retry message.

Authentication, chat, and report rate limits remain defined in `docs/TESTING_SECURITY.md` and are implemented in their respective milestones.

## Client behavior (mobile)

- TanStack Query keys include filter hash + cursor.
- Stale time: 60 seconds for Discover lists; pull-to-refresh always allowed.
- Persist last-used filters in local storage; default filters from profile zones + skill band.
- Optimistic UI **not** used for discovery results.
- On block success: invalidate both discovery queries and any player detail cache.

## Empty states

When zero results, show **actionable** copy (localized via `packages/i18n`):

### Open matches empty

1. Widen zone filter (suggest adjacent zones from seed config).
2. Include “any intent” / both formats.
3. CTA: **Create a match** (primary liquidity action).
4. Secondary: adjust availability (link to availability editor).

### Compatible players empty

1. Widen level window automatically once (±1 → ±2) and show banner: “Showing nearby levels.”
2. Toggle off “Must overlap my availability.”
3. Widen zones.
4. CTA: **Create a match** or **Invite from link** after M3.

Never show an empty screen without explaining how to create liquidity.

## Analytics

Fire `discovery_search_performed` (see `docs/ARCHITECTURE.md`) with:

- `surface`: `open_matches` | `compatible_players`
- `zone_count`, `format`, `intent`, `result_count`
- `widened_level` boolean
- `require_availability_overlap` boolean

Never include user IDs of results, raw filters as free text, or timestamps of availability.

## Testing (Milestone 2 exit)

### Database tests (required)

Identities from `docs/TESTING_SECURITY.md`:

- Active player A discovers active player B with overlapping zones/availability.
- Blocked pair does not appear in either direction.
- Suspended user cannot call RPC / appears in no results.
- Open match hidden when full, non-public, wrong zone, or level out of range.
- Past-only proposed times excluded.
- Skill min/max constraint rejects invalid match insert.

### Unit tests (`packages/domain`)

- Skill rank ordering and ±N window.
- Interval expansion for recurring availability (Beirut timezone edge cases).
- Overlap minimum duration (60 minutes).
- Empty-state widening rules.

### Integration tests

- Discover tab loading, empty, error, retry states.
- Filter change invalidates query.
- Arabic RTL layout on Discover list (smoke).

## Seed data (pilot)

M2 requires seeded:

- 3–5 active zones in one pilot corridor (exact geography is a founder decision).
- 10+ test players with varied bands, zones, and availability patterns.
- 5+ open public matches in mixed states for QA.

Document seed IDs in `supabase/seed.sql`; no production personal data.

## Migration checklist (M2)

- [ ] `skill_band_rank()` function
- [ ] `matches` min/max skill check constraint
- [ ] Discovery RPCs + grants to `authenticated`
- [ ] `discovery_search_log` or audit-based rate limit
- [ ] Indexes from [Indexes](#indexes-add-in-m2-migration)
- [ ] RLS policies documented above
- [ ] pgTAP or SQL tests in CI for exclusion matrix

---

## Open design items from project review

Items outside pure discovery that still affect M2 or adjacent milestones. Track resolutions in `docs/DECISIONS.md`.

### 1. Gender preference (PRD mention)

**Status:** **Resolved** — excluded from v1 per `docs/DECISIONS.md` (2026-07-25). No schema column until legal/product approval.

### 2. Match expiry (`expired` status)

**Issue:** State machine includes `expired` but no transition rules.

**Proposal:** See `docs/LIFECYCLE.md`. Discovery impact: `status = 'open'` matches with all proposed times older than 24h auto-expire via scheduled job; expired matches never appear in discovery.

### 3. `in_progress` transition

**Issue:** Undefined trigger for `confirmed → in_progress`.

**Proposal:** See `docs/LIFECYCLE.md`. Scheduled job at `booking.starts_at` when booking is `accepted`.

### 4. Match capacity enforcement

**Issue:** Documented invariant but no DB enforcement yet.

**Proposal:** Milestone 3 RPC `accept_join_request()` uses `SELECT … FOR UPDATE` on match row and checks participant count before insert. Optional deferred constraint trigger for defense in depth.

### 5. Notification worker

**Issue:** Outbox table exists; sender unspecified.

**Proposal:** Supabase Edge Function on cron (every 1–5 min) processing `notifications where sent_at is null and scheduled_at <= now()`, with dedup key — implement in M6.

### 6. Report flow timing

**Issue:** Full report queue in M8 is late for safety.

**Proposal:** M2 block exclusion (above); M6 minimal report insert + email/ops alert; M8 full admin queue UI.

### 7. Cancellation / no-show policy

**Issue:** Deferred to M8 with clubs.

**Proposal:** Ship **placeholder policy copy** in i18n in M3 (generic “cancellation may affect reliability”); finalize numeric windows (e.g. 24h late cancel) in M8 before public pilot.

### 8. Auth method undecided

**Status:** **Resolved** — email magic link only for v1 per `docs/DECISIONS.md` (2026-07-25).

### 9. Juniors policy undecided

**Status:** **Resolved** — minors excluded from v1 matchmaking per `docs/DECISIONS.md` (2026-07-25). `is_adult_confirmed = true` required for public discovery and matchmaking.

### 10. Analytics provider

**Issue:** README mentions PostHog; architecture is provider-agnostic.

**Proposal:** Accept in M0; wire PostHog after consent banner in M1/M8; use event names from `docs/ARCHITECTURE.md` only.
