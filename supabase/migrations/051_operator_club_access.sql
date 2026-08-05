-- Clubs entered by ops were invisible and uneditable in the dashboard.
--
-- 050 let a platform operator enter a club without taking a membership, which
-- is right -- it is not their club. But every club screen authorises through
-- assert_club_admin or assert_club_staff, and both ask only "are you a member",
-- so the operator who just created the club could not open its settings, its
-- courts or its hours. list_staff_clubs reads memberships too, so the club did
-- not even appear in the dashboard's club list. It went live for players and
-- vanished for the person who added it.
--
-- 050 patched update_club_booking_settings on its own, which fixed the one
-- function it happened to notice and left the rest. The gates themselves are
-- the right place: a platform operator already approves clubs, resolves
-- disputes and reviews safety reports, so club administration is not a wider
-- power than they hold. Fixing them once covers settings, courts, hours,
-- blocks and the booking queue together, and anything added later.
--
-- Every existing caller keeps its meaning: a club member is authorised exactly
-- as before, and only an operator is newly admitted.

create or replace function public.assert_club_admin(p_club_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  -- A platform operator administers every club: in v1 they are the ones who
  -- entered them, and no club account exists to hold the keys.
  if public.viewer_is_platform_operator() then
    return v_user_id;
  end if;

  if not public.is_club_admin(p_club_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Club admin access required';
  end if;

  return v_user_id;
end;
$$;

create or replace function public.assert_club_staff(p_club_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if public.viewer_is_platform_operator() then
    return v_user_id;
  end if;

  if not public.is_club_staff(p_club_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Not authorized for this club';
  end if;

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- The dashboard club list has to show the clubs ops entered
--
-- Copied forward from 031:446. A member still sees only their own clubs and
-- their real role; an operator sees every club, including ones still waiting
-- in the approval queue, since those are exactly the ones needing attention.
-- ---------------------------------------------------------------------------

create or replace function public.list_staff_clubs()
returns table (
  club_id uuid,
  name text,
  slug text,
  role text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if public.viewer_is_platform_operator() then
    return query
    select c.id, c.name, c.slug, 'operator'::text, c.is_active
    from public.clubs as c
    order by c.is_active, c.name;

    return;
  end if;

  return query
  select
    c.id,
    c.name,
    c.slug,
    cm.role::text,
    c.is_active
  from public.club_memberships as cm
  join public.clubs as c on c.id = cm.club_id
  join public.profiles as p on p.id = cm.user_id
  where cm.user_id = v_user_id
    and cm.is_active = true
    and cm.role in ('staff', 'admin')
    and p.account_status = 'active'
  order by c.name;
end;
$$;

revoke all on function public.list_staff_clubs() from public, anon;
grant execute on function public.list_staff_clubs() to authenticated;
