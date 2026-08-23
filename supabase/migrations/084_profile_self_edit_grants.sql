-- Editing your own name, languages or bio failed with "permission denied for
-- table profiles".
--
-- `updateOwnProfile` writes `profiles` (display_name, languages) and then
-- `player_profiles` (bio). `002` granted `authenticated` only SELECT on
-- `profiles` plus `update (avatar_path)` -- display_name and languages were
-- never grantable -- and `042` later revoked avatar_path when avatars moved
-- behind `set_own_avatar`. That left `profiles` with no UPDATE grant at all, so
-- the first statement failed and took the whole call with it. Both callers
-- broke: `/profile/edit` could not save a name, and the About box could not
-- save a bio, because it sends the unchanged name along with it.
--
-- An RLS policy filters rows; it does not confer table privileges. Migration
-- `062` fixed exactly this shape on `notifications` and the same reasoning
-- applies here: `profiles_update_own` has been in place since `001` and is
-- still what confines the write to the caller's own row.
--
-- Granted per column rather than table-wide, keeping the `002` posture: the
-- Data API gets only what a player edits about themselves. Everything
-- privileged stays where it was put -- `avatar_path` behind `set_own_avatar`,
-- `gender` behind `set_own_gender`, `onboarding_completed_at` and
-- `account_status` behind nothing a client can reach at all.

grant update (display_name, languages) on table public.profiles to authenticated;

-- `display_name` already had a CHECK; `languages` had none, so a caller
-- reaching past the app could store an empty array or an unsupported code and
-- every surface reading it would have to defend itself. Mirrors the constraint
-- `061` put on `notification_locale`.
-- `cardinality`, not `array_length`: the latter returns NULL for an empty array
-- rather than 0, and a CHECK only rejects on FALSE, so `array[]::text[]` would
-- have passed a length test written the obvious way.
alter table public.profiles
  drop constraint if exists profiles_languages_supported;

alter table public.profiles
  add constraint profiles_languages_supported
  check (
    cardinality(languages) >= 1
    and languages <@ array['en', 'ar', 'fr']::text[]
  );
