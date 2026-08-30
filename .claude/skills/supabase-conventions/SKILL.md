---
name: supabase-conventions
description: Database conventions for this repository — grants on every function, search_path pinning, why RLS is deny-all, pgTAP pairing, and where environment data lives. Use whenever writing or reviewing a Supabase migration, adding an RPC, or reasoning about who can call what.
---

# Supabase conventions

Rules this codebase already follows in 95 migrations. They are written down because the last two violations were added by sessions that could not see a convention which had been consistent since migration `061`.

## The grants are the security boundary

Twenty tables have RLS **enabled with no policies**. That is deny-all, and it is deliberate: every access path goes through a `security definer` RPC. `CLAUDE.md` states the rule — _"Use server-side or database functions for privileged actions."_

The consequence is the thing to internalise: **there is no RLS backstop underneath the functions.** A `security definer` function left at the default grant is a public PostgREST endpoint, running with RLS bypassed, carrying whatever authorization it wrote itself — often none.

### Every function ends with a grant statement. Two idioms, no third.

**Caller-facing RPC** — something the app calls:

```sql
revoke all on function public.withdraw_join_request(uuid) from public, anon;
grant execute on function public.withdraw_join_request(uuid) to authenticated;
```

**Internal helper** — called only by other functions:

```sql
revoke all on function public.notify_match_participants(uuid, text, uuid, text)
  from public, anon, authenticated;
```

An internal helper stays callable from a definer RPC regardless, because inside one the current role is the definer. Revoking costs nothing and closes the endpoint.

**`anon` must be named in the revoke.** Supabase grants EXECUTE on public functions to both `anon` and `authenticated` by default, so `revoke ... from public` alone leaves the explicit `anon` grant standing and the endpoint open. `038` and `042` did exactly that; the functions stayed anon-reachable for fifty-odd migrations. Both defended themselves in the body, so nothing was exploitable — but the door was open, and a later edit relaxing a body check would have opened it for real.

**Trigger functions are the exception.** They keep the default grant — a trigger function cannot be usefully invoked without `OLD` and `NEW`. `notify_match_roster_change` and `notify_match_cancelled` both do.

### What happens when this is missed

`append_booking_event` sat at the default grant from migration `014` until `095`. It takes `p_actor_id` as a parameter, inserts unconditionally, and checks nothing about its caller — so any authenticated user holding a booking id, which `get_match_hub` hands to every participant, could write booking audit rows attributed to anyone including club staff. The foreign key rejected invented booking ids and nothing else. That audit trail is what `PILOT_OPERATIONS.md` sends an operator to read when a booking is disputed.

`scripts/validate-migrations.mjs` now fails a migration that adds a non-trigger definer function with no grant statement, and one whose revoke does not name `anon`.

The runtime sweep in `STAGING_CHECKLIST.md` §2 is the backstop, and it asks `has_function_privilege('anon', ...)` rather than testing for an empty ACL. An earlier version checked `proacl is null`, which only ever caught functions at the _default_ grant — the two revoked `from public` without `anon` had an explicit ACL and passed it. Supabase's own `get_advisors` found them on the staging project, which is the argument for running it there: it sees the grants as they end up, not as the migrations describe them.

## `set search_path = ''` on every definer function

Universal in this codebase — zero exceptions. Without it, a definer function resolves unqualified names through the caller's `search_path`, which is a privilege-escalation path.

Schema-qualify everything, including `auth.uid()` and `public.` on your own helpers.

## Authorization inside the function

Caller-facing RPCs start with `assert_marketplace_caller()`, then check the specific right:

```sql
v_creator_id := public.assert_marketplace_caller();
if v_match.creator_id <> v_creator_id then
  raise exception using errcode = '42501', message = 'Only the creator can respond to join requests';
end if;
```

Raise stable, greppable messages — clients map them (`apps/mobile/src/lib/join-error.ts`). Use `42501` for authorization, `P0002` for not-found, `P0001` for rule violations.

## Only show a row to whoever can act on it

`pending_requests` and `invited_players` on `match_hub_card` are gated on `coalesce(v_is_creator, false)`. A decline is the inviter's business; a pending request is the host's. Telling the rest of the roster publishes a decision nobody has made yet.

## pgTAP pairs with behaviour, not with every file

71 test files against 95 migrations. A migration that adds behaviour gets one; a pure grant or comment migration does not.

**Authorization claims must be asserted, never assumed.** The useful shape is: the person who may act succeeds, the person who may not is refused, and the thing that looks similar but is different does not count — for example, a host withdrawing an invitation must not be reported as the invitee declining it.

Fixtures share a database. If several fixture matches need distinct hours, draw them from a temp sequence — `090` blocks joining an overlapping agreed hour, and three older test files had to be fixed because they built every match in one slot.

## Migrations are schema; environment data is not

- Migrations run everywhere, including `pnpm db:reset`.
- Environment data lives in `supabase/pilot/` — see `beirut-zones.sql`, which is idempotent and safe to re-run.
- `seed.sql` is **local only**. Its `@tennis-lebanon.test` accounts and `Pilot North/Central/South` zones must never reach a hosted project.

## Never rewrite an applied migration

Add a new one. Applies to anything that has run against a shared environment.

## No dynamic SQL

Zero `EXECUTE format(...)` across 95 migrations. There is no SQL-injection surface in this schema; keep it that way. If you think you need dynamic SQL, you probably need a different query.

## Before you finish

```bash
node scripts/validate-migrations.mjs   # naming, RLS heuristic, definer grants
pnpm db:test                           # pgTAP, needs Docker
pnpm verify:pilot                      # lint, types, unit, migrations, format
```

Regenerate types when the schema moves: `pnpm db:types`.
