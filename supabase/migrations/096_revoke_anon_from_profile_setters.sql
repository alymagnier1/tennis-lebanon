-- Two setters stayed reachable by `anon`, and the sweep that should have caught
-- them could not see it.
--
-- `038` and `039`/`042` wrote `revoke all on function … from public;` and left
-- out `anon`. Supabase grants EXECUTE on public functions to `anon` and
-- `authenticated` by default, so revoking from `public` alone leaves the
-- explicit `anon` grant standing — the house idiom is `from public, anon`.
--
-- Neither is exploitable today: `set_own_skill_band` calls
-- `assert_marketplace_caller()`, and `set_player_preferred_zones` raises 42501
-- when `auth.uid()` is null. Both reject an anonymous caller in the body. This
-- is defence in depth — the endpoints should not be reachable at all, and a
-- later edit that relaxed a body check would turn a closed door into an open
-- one without anyone touching the grants.
--
-- Found by `get_advisors` on the staging project, which is the point of running
-- it: the sweep recorded in `STAGING_CHECKLIST.md` §2 tested `proacl is null`
-- and so only ever caught functions at the *default* grant. A function with an
-- explicit ACL that happens to include `anon` passed it. That query is widened
-- to `has_function_privilege('anon', …)` in the same change, and the
-- `validate-migrations.mjs` check now requires `anon` to be named in the revoke.

revoke all on function public.set_own_skill_band(public.skill_band)
  from public, anon;

revoke all on function public.set_player_preferred_zones(uuid[])
  from public, anon;
