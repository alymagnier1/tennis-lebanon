-- The prefilled WhatsApp message told clubs the wrong hour.
--
-- get_club_whatsapp_booking_link rendered the agreed slot with
-- `at time zone 'UTC'` and labelled it "Preferred time (UTC)". Club staff in
-- Beirut read a bare number and book it: an 18:00 match reads as 15:00 in
-- summer and 16:00 in winter, so the court is two or three hours out.
--
-- This was survivable while it was one channel among several, and while a
-- second bug cancelled it out -- beirutLocalToUtcIso stored a Beirut wall clock
-- as though it were UTC, so 18:00 was written as 18:00Z and rendered back as
-- "18:00". Fixing that storage bug left this one exposed: the hour is now
-- stored correctly and rendered wrongly.
--
-- It also stopped being one channel among several. With the club dashboard
-- deferred out of v1 (see docs/DECISIONS.md, 2026-08-03), this message is the
-- only thing the app ever sends a club, so a wrong number here is a wrong
-- court booking with nothing downstream to catch it.
--
-- Asia/Beirut throughout, no timezone label, and a shape a person reads:
-- "Fri 07 Aug 18:00 to 19:30" rather than two ISO-ish stamps. The message is
-- still English only; offering it in Arabic or French is a separate decision.

create or replace function public.get_club_whatsapp_booking_link(
  p_club_id uuid,
  p_match_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_club public.clubs%rowtype;
  v_phone text;
  v_message text;
  v_match public.matches%rowtype;
  v_time public.match_time_options%rowtype;
  v_participant_count integer;
begin
  v_user_id := public.assert_discovery_caller_eligible();

  select *
  into v_club
  from public.clubs as c
  where c.id = p_club_id
    and c.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if v_club.booking_mode <> 'external_link' then
    raise exception using errcode = 'P0001', message = 'Club does not offer WhatsApp booking';
  end if;

  select public.normalize_booking_phone(cpc.booking_phone)
  into v_phone
  from public.club_private_contacts as cpc
  where cpc.club_id = p_club_id;

  if v_phone is null then
    raise exception using errcode = 'P0001', message = 'Club WhatsApp booking is not configured';
  end if;

  v_message := format(
    'Hello, I would like to book a court at %s through Tennis Lebanon.',
    v_club.name
  );

  if p_match_id is not null then
    select *
    into v_match
    from public.matches as m
    where m.id = p_match_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'Match not found';
    end if;

    if not exists (
      select 1
      from public.match_participants as mp
      where mp.match_id = p_match_id
        and mp.user_id = v_user_id
        and mp.status = 'accepted'
    ) then
      raise exception using errcode = '42501', message = 'Match participant access required';
    end if;

    select count(*)::integer
    into v_participant_count
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'accepted';

    if v_match.selected_time_option_id is not null then
      select *
      into v_time
      from public.match_time_options as mto
      where mto.id = v_match.selected_time_option_id;
    end if;

    -- Built by concatenation rather than one dense format string. The original
    -- template put the newline in front of the optional time block, so the line
    -- after it ran on: "18:00 to 19:30Players: 2", and with no agreed time the
    -- same seam produced "Format: doublesPlayers: 2". Each line now carries its
    -- own break.
    v_message := format(
      'Hello, I would like to book a court at %s through Tennis Lebanon.',
      v_club.name
    )
    || format(E'\nFormat: %s', v_match.format)
    || case
         when v_time.id is not null then
           format(
             E'\nPreferred time: %s to %s',
             to_char(v_time.starts_at at time zone 'Asia/Beirut', 'Dy DD Mon HH24:MI'),
             to_char(v_time.ends_at at time zone 'Asia/Beirut', 'HH24:MI')
           )
         else ''
       end
    || format(E'\nPlayers: %s', coalesce(v_participant_count::text, '?'));
  end if;

  return jsonb_build_object(
    'club_id', v_club.id,
    'club_name', v_club.name,
    'phone_digits', v_phone,
    'message', v_message
  );
end;
$$;

revoke all on function public.get_club_whatsapp_booking_link(uuid, uuid) from public, anon;
grant execute on function public.get_club_whatsapp_booking_link(uuid, uuid) to authenticated;
