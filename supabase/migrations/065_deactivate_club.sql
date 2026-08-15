-- Platform operators can retire a club without destroying its history.
--
-- clubs.is_active already gates every player-facing read -- RLS on clubs and
-- courts (001), discovery, favorites, and every booking-creation path (014,
-- 017, 030, 034, 041, 045, 046, 047, 049, 051, 054, 057, 058, 064) all check
-- it. So flipping it off is enough to disappear a club everywhere a player
-- looks, while its courts, bookings, and audit history stay intact -- there
-- is no DELETE here, matching CLAUDE.md's rule against destructive deletion
-- of operational records. review_pilot_club (031) already proved the same
-- lever works for rejecting a club that never launched; this is the same
-- flip for a club that has been live and needs to come down.
--
-- A club with a booking still in play (requested, alternative_proposed, or
-- accepted) refuses to deactivate: hiding the club would strand the club's
-- side of that booking with no queue and no notice to the player. The
-- operator has to resolve those first, same as list_club_booking_requests
-- would show them.
--
-- Restricted to platform operators, same authority that already approves,
-- rejects, and administers every club (050, 051) -- not club_memberships
-- admins, who run their own club day to day but do not get to take it
-- offline platform-wide.

create or replace function public.deactivate_club(
  p_club_id uuid,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_club public.clubs%rowtype;
  v_reason text;
  v_open_bookings integer;
begin
  v_admin_id := public.assert_platform_operator();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  select *
  into v_club
  from public.clubs as c
  where c.id = p_club_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if not v_club.is_active then
    raise exception using errcode = 'P0001', message = 'Club is already inactive';
  end if;

  select count(*)::integer
  into v_open_bookings
  from public.bookings as b
  join public.courts as ct on ct.id = b.court_id
  where ct.club_id = p_club_id
    and b.status in ('requested', 'alternative_proposed', 'accepted');

  if v_open_bookings > 0 then
    raise exception using errcode = 'P0001', message = format(
      'Club has %s open booking(s); resolve them before deactivating',
      v_open_bookings
    );
  end if;

  update public.clubs
  set is_active = false, updated_at = now()
  where id = p_club_id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_admin_id,
    'club_deactivated',
    'club',
    p_club_id,
    v_reason,
    jsonb_build_object('slug', v_club.slug)
  );
end;
$$;

-- Undoes the above. The schema has no separate "pending approval" flag --
-- both a club nobody has reviewed yet and a club taken down after launch
-- read as is_active = false -- so this also happens to bring a never-
-- approved club live, logged as 'club_reactivated' rather than
-- 'club_approved'. That is a blurred audit label, not a wider power: the
-- only caller who could deactivate a live club is the same platform
-- operator who could approve a pending one via review_pilot_club (031).
create or replace function public.reactivate_club(
  p_club_id uuid,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_club public.clubs%rowtype;
  v_reason text;
begin
  v_admin_id := public.assert_platform_operator();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  select *
  into v_club
  from public.clubs as c
  where c.id = p_club_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if v_club.is_active then
    raise exception using errcode = 'P0001', message = 'Club is already active';
  end if;

  update public.clubs
  set is_active = true, updated_at = now()
  where id = p_club_id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_admin_id,
    'club_reactivated',
    'club',
    p_club_id,
    v_reason,
    jsonb_build_object('slug', v_club.slug)
  );
end;
$$;

revoke all on function public.deactivate_club(uuid, text) from public, anon, authenticated;
grant execute on function public.deactivate_club(uuid, text) to authenticated;

revoke all on function public.reactivate_club(uuid, text) from public, anon, authenticated;
grant execute on function public.reactivate_club(uuid, text) to authenticated;
