-- Milestone 2 gaps: dedicated public player detail RPC.

create or replace function public.get_public_player_card(p_user_id uuid)
returns public.discover_compatible_player_card
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_viewer_band public.skill_band;
  v_viewer_intent public.play_intent;
  v_range_start timestamptz := now();
  v_range_end timestamptz := now() + interval '14 days';
  v_card public.discover_compatible_player_card;
begin
  v_viewer_id := public.assert_discovery_caller_eligible();

  if p_user_id = v_viewer_id then
    raise exception using
      errcode = '42501',
      message = 'Cannot load own public card via this RPC';
  end if;

  select pp.skill_band, pp.play_intent
  into v_viewer_band, v_viewer_intent
  from public.player_profiles as pp
  where pp.user_id = v_viewer_id;

  select
    p.id,
    p.display_name,
    p.avatar_path,
    pp.skill_band,
    pp.play_intent,
    pp.prefers_singles,
    pp.prefers_doubles,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', z.id,
            'slug', z.slug,
            'name_i18n', z.name_i18n
          )
          order by pz.priority
        ),
        '[]'::jsonb
      )
      from public.player_zones as pz
      join public.zones as z on z.id = pz.zone_id
      where pz.user_id = p.id
        and z.is_active = true
    ),
    case
      when pp.rated_match_count < 5 then 'provisional'
      else 'established'
    end,
    public.completed_match_count_for_user(p.id),
    abs(
      public.skill_band_rank(pp.skill_band)
      - public.skill_band_rank(v_viewer_band)
    ) <= 1,
    exists (
      select 1
      from public.player_zones as viewer_zones
      join public.player_zones as candidate_zones
        on candidate_zones.zone_id = viewer_zones.zone_id
      where viewer_zones.user_id = v_viewer_id
        and candidate_zones.user_id = p.id
    ),
    public.has_availability_overlap(
      v_viewer_id,
      p.id,
      v_range_start,
      v_range_end
    ),
    (pp.play_intent = v_viewer_intent or pp.play_intent = 'either' or v_viewer_intent = 'either'),
    (pp.prefers_singles or pp.prefers_doubles)
  into v_card
  from public.profiles as p
  join public.player_profiles as pp on pp.user_id = p.id
  where p.id = p_user_id
    and p.account_status = 'active'
    and p.onboarding_completed_at is not null
    and p.is_adult_confirmed = true
    and not public.is_blocked(v_viewer_id, p.id);

  if v_card.user_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Player not found';
  end if;

  return v_card;
end;
$$;

revoke all on function public.get_public_player_card(uuid) from public, anon;
grant execute on function public.get_public_player_card(uuid) to authenticated;
