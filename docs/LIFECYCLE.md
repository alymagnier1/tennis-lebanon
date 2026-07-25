# Match and Booking Lifecycle

Defines state transitions left underspecified in the initial architecture review: **expiry**, **`in_progress`**, **cancellation**, and **club timeout**. Discovery and notifications depend on these rules.

Store authoritative status on `matches` and `bookings`. Validate transitions in `packages/domain` and enforce privileged changes through Postgres RPCs.

## Match state machine

```text
draft → open → full → ready_to_book → booking_pending → confirmed → in_progress → completed

Side exits: cancelled | expired | disputed
```

`match_status.disputed` is reserved for explicit platform-admin action on the match itself. A disputed **result** does not change match status: the match stays `completed` with `result_status = disputed` until ops or admin resolves it (see E7).

## Transition table

| From                | To                | Trigger                                                | Actor              |
| ------------------- | ----------------- | ------------------------------------------------------ | ------------------ |
| `draft`             | `open`            | Creator publishes match                                | Creator (RPC)      |
| `open`              | `full`            | Required participants accepted                         | System on join RPC |
| `full`              | `open`            | Participant leaves before booking                      | System             |
| `full`              | `ready_to_book`   | All required participants voted yes on one time option | System on vote RPC |
| `ready_to_book`     | `full`            | Time option withdrawn or vote revoked                  | System             |
| `ready_to_book`     | `booking_pending` | Creator submits booking request                        | Creator (RPC)      |
| `booking_pending`   | `ready_to_book`   | Booking rejected and match still viable                | System             |
| `booking_pending`   | `confirmed`       | Booking accepted (or alternative accepted)             | Club staff (RPC)   |
| `confirmed`         | `in_progress`     | Scheduled start reached                                | Scheduled job      |
| `in_progress`       | `completed`       | Result confirmed or admin resolution                   | System / admin     |
| `*` (pre-confirmed) | `cancelled`       | Creator cancel or policy-based mass cancel             | Creator / system   |
| `open` / `full`     | `expired`         | Expiry rules below                                     | Scheduled job      |
| `*`                 | `disputed`        | Platform admin flags match for ops review              | Platform admin     |

Invalid transitions must fail in RPC with a stable error code.

## Expiry rules (`→ expired`)

Applies only while `status in ('open', 'full')` and no accepted booking exists.

A match **expires** when **any** condition is true:

1. **All proposed times passed:** every non-withdrawn `match_time_options.ends_at` is more than **24 hours** before `now()`.
2. **Stale listing:** `matches.created_at` is older than **7 days** and status is still `open` or `full`.
3. **Manual:** creator cancels explicitly (`cancelled`, not `expired`) — prefer `cancelled` for user-initiated action.

On expiry:

- Set `status = 'expired'`.
- Notify participants (if any) with generic “match expired” (M6).
- Remove from discovery immediately.

**Configurable constants** (store in app config table or env, not hard-coded in UI):

- `MATCH_EXPIRY_GRACE_HOURS = 24`
- `MATCH_MAX_OPEN_DAYS = 7`

## `in_progress` rules

Set `status = in_progress` when:

- `matches.status = confirmed`
- Active booking has `status = accepted`
- `now() >= bookings.starts_at`
- Not cancelled

Optional manual override: club staff “check-in” may set `in_progress` up to **30 minutes before** start (M5+ ops feature).

Revert **not** allowed except via platform admin audit action.

## Completion rules (`→ completed`)

Set `status = completed` when the result workflow reaches `confirmed` or admin `resolved`.

Attendance confirmation alone does **not** complete a match in v1. A mutually confirmed result (or admin resolution) is required for completion, rating, and the north-star metric.

## Cancellation and leave (placeholder policy)

Final numeric policy is agreed with pilot clubs in M8. Until then, implement mechanics with configurable windows:

| Action                                    | Default v1 placeholder                                   | Reliability impact                        |
| ----------------------------------------- | -------------------------------------------------------- | ----------------------------------------- |
| Creator cancel before full                | Allowed freely                                           | None                                      |
| Creator cancel after full, before booking | Allowed with reason                                      | None                                      |
| Participant leave before full             | Allowed                                                  | None                                      |
| Participant leave after full              | Allowed with confirmation                                | Flag for ops review only                  |
| Cancel after booking accepted             | Requires reason; within **24h** of start = `late_cancel` | Record attendance enum                    |
| No-show                                   | Marked in attendance window post-start                   | Private reliability note; no public score |

**Leave vs cancel:** If creator leaves, cancel whole match. If non-creator leaves and capacity still met, revert toward `open` / `full` as appropriate.

Reliability data remains **private to user and ops** in v1 (PRD §3).

## Club booking timeout

Failure state in Flow B: club does not respond.

**v1 behavior (no auto-reject in pilot):**

- After **4 hours** in `booking_pending`, nudge club staff via notification.
- After **24 hours**, notify participants “still awaiting club”; suggest creator pick another club or withdraw request.
- Do **not** auto-cancel booking without human confirmation in v1.

Constants:

- `BOOKING_NUDGE_HOURS = 4`
- `BOOKING_STALE_HOURS = 24`

Revisit auto-reject post-pilot based on club response metrics.

## Scheduled jobs

| Job                         | Frequency    | Action                                       |
| --------------------------- | ------------ | -------------------------------------------- |
| `expire_stale_matches`      | Hourly       | Apply expiry rules                           |
| `start_in_progress_matches` | Every 5 min  | `confirmed → in_progress`                    |
| `booking_stale_reminders`   | Hourly       | Club nudge / participant stale notice        |
| `open_attendance_window`    | Every 15 min | After start, trigger attendance prompts (M7) |

Implement as Supabase Edge Function cron or `pg_cron` where available. Same worker infrastructure as notification outbox (M6).

## Discovery interaction

- Only `status = open` and `visibility = public` matches appear in `discover_open_matches`.
- `full` matches may appear with “waitlist” UX post-M3 if product adds waitlist; **not in v1**.
- Expired/cancelled matches never appear.

## Database enforcement (by milestone)

| Milestone | Enforcement                                              |
| --------- | -------------------------------------------------------- |
| M3        | Join RPC with row lock + capacity check                  |
| M4        | Vote RPC selects time; transition to `ready_to_book`     |
| M5        | Booking accept RPC; overlap constraint already in schema |
| M6        | Scheduled jobs for expiry and `in_progress`              |
| M7        | Result finalization RPC → `completed`                    |

## Testing

- Unit: valid/invalid transitions in `packages/domain`.
- Database: concurrent join cannot exceed capacity; expired match rejects join.
- Integration: match disappears from Discover after expiry job runs.

## Decisions to record

When founder and clubs agree on final cancellation windows, append an entry to `docs/DECISIONS.md` and replace placeholder constants above without rewriting applied migrations (use config table).
