-- `078` shipped `gender` as ('woman', 'man', 'other') earlier today. The pilot
-- wants the two-value vocabulary instead.
--
-- Recreated rather than altered: PostgreSQL can add enum members but not remove
-- them, and renaming two while dropping a third is not expressible as an ALTER.
-- The column is dropped and re-added, which is safe here and only here --
-- `078` has not reached any environment beyond a local `db:reset`, so there is
-- no stored gender anywhere to lose. Once staging exists this stops being an
-- option and a value change would need a backfill instead.

drop function if exists public.set_own_gender(public.gender);

alter table public.profiles
  drop column if exists gender;

drop type if exists public.gender;

do $$
begin
  create type public.gender as enum ('female', 'male');
exception
  when duplicate_object then null;
end;
$$;

alter table public.profiles
  add column if not exists gender public.gender;

comment on column public.profiles.gender is
  'Optional self-declared gender. Null means not stated. Display only: no discovery filter reads it.';

revoke update (gender) on table public.profiles from authenticated;

create or replace function public.set_own_gender(
  p_gender public.gender default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  -- Deliberately not the marketplace guard: this is set during onboarding,
  -- before `onboarding_completed_at` exists.
  v_user_id := public.assert_authenticated_caller();

  update public.profiles
  set gender = p_gender
  where id = v_user_id;
end;
$$;

revoke all on function public.set_own_gender(public.gender) from public, anon;
grant execute on function public.set_own_gender(public.gender) to authenticated;
