-- Milestone 1 hardening: close client-side integrity gaps before M2 discovery.

revoke update (skill_band) on table public.player_profiles from authenticated;

create or replace function public.enforce_active_player_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.zones as z
    where z.id = new.zone_id
      and z.is_active = true
  ) then
    raise exception using
      errcode = '22023',
      message = 'Zone must exist and be active';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_active_player_zone() from public;

drop trigger if exists player_zones_enforce_active on public.player_zones;
create trigger player_zones_enforce_active
before insert or update on public.player_zones
for each row execute function public.enforce_active_player_zone();

revoke all on table public.availability_windows from public, anon, authenticated;
revoke all on table public.clubs from public, anon, authenticated;
revoke all on table public.club_private_contacts from public, anon, authenticated;
revoke all on table public.courts from public, anon, authenticated;
revoke all on table public.court_operating_hours from public, anon, authenticated;
revoke all on table public.court_blocks from public, anon, authenticated;
revoke all on table public.matches from public, anon, authenticated;
revoke all on table public.match_zones from public, anon, authenticated;
revoke all on table public.match_participants from public, anon, authenticated;
revoke all on table public.match_time_options from public, anon, authenticated;
revoke all on table public.match_time_votes from public, anon, authenticated;
revoke all on table public.match_invitations from public, anon, authenticated;
revoke all on table public.match_messages from public, anon, authenticated;
revoke all on table public.bookings from public, anon, authenticated;
revoke all on table public.booking_events from public, anon, authenticated;
revoke all on table public.match_results from public, anon, authenticated;
revoke all on table public.rating_events from public, anon, authenticated;
revoke all on table public.user_blocks from public, anon, authenticated;
revoke all on table public.user_reports from public, anon, authenticated;
revoke all on table public.device_push_tokens from public, anon, authenticated;
revoke all on table public.notifications from public, anon, authenticated;
