-- An account created through Google has no password, and nothing told anyone.
--
-- `request_account_deletion` aside, the two doors into this app write different
-- things: sign-up with a password fills `auth.users.encrypted_password`, and
-- the native Google flow does not. Supabase links a later Google sign-in onto
-- an existing email account, so password-first players end up holding both --
-- but Google-first players hold only the one, and a password typed against
-- that account fails as `invalid_credentials`. It reads as "wrong password",
-- so the player resets a password that never existed and arrives back at the
-- same refusal.
--
-- The fix is to let them set one. `updateUser({ password })` already does that
-- for a signed-in caller -- `secure_password_change` is off, so it needs no
-- reauthentication -- and the screen for it exists, built for recovery. What
-- was missing is the app knowing whether to offer it, because
-- `encrypted_password` is not in the session and must not be.
--
-- Scoped to `auth.uid()` and returning a bare boolean: it answers only for the
-- caller, about their own account. It cannot be pointed at an address, so it
-- adds no way to test whether one is registered -- the enumeration property
-- Supabase protects by refusing to name an account's providers at all.
create or replace function public.caller_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as u
    where u.id = (select auth.uid())
      and u.encrypted_password is not null
      and u.encrypted_password <> ''
  );
$$;

revoke all on function public.caller_has_password() from public, anon;
grant execute on function public.caller_has_password() to authenticated;
